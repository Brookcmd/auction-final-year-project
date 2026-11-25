import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../../common/services/audit.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { QueryAuctionsDto } from './dto/query-auctions.dto';
import { AuctionStatus, NotificationType } from '@prisma/client';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private auditService: AuditService,
  ) {}

  private generateItemCode(): string {
    const year = new Date().getFullYear();
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `BID-${year}-${randomPart}`;
  }

  async create(sellerId: string, dto: CreateAuctionDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('Auction end time must be after start time');
    }

    // Controlled governance lifecycle: sellers submit to DRAFT, SUBMITTED, or INSPECTION_REQUIRED
    let initialStatus: AuctionStatus = AuctionStatus.SUBMITTED;
    if (dto.saveAsDraft) {
      initialStatus = AuctionStatus.DRAFT;
    } else if (dto.requiresInspection) {
      initialStatus = AuctionStatus.INSPECTION_REQUIRED;
    }

    const auction = await this.prisma.auction.create({
      data: {
        sellerId,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        condition: dto.condition,
        locationCity: dto.locationCity || 'Addis Ababa',
        startingPrice: dto.startingPrice,
        currentHighestBid: dto.startingPrice,
        reservePrice: dto.reservePrice || null,
        bidIncrement: dto.bidIncrement || 100,
        status: initialStatus,
        requiresInspection: !!dto.requiresInspection,
        requiresBidSecurity: !!dto.requiresBidSecurity,
        isRestricted: !!dto.isRestricted,
        bidSecurityPolicyId: dto.bidSecurityPolicyId || null,
        startTime,
        endTime,
        originalEndTime: endTime,
        images: dto.imageUrls
          ? {
              create: dto.imageUrls.map((url, index) => ({
                url,
                displayOrder: index,
                isCover: index === 0,
              })),
            }
          : undefined,
      },
      include: {
        images: true,
        category: true,
        seller: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, isKycVerified: true, city: true, avatarUrl: true } },
          },
        },
      },
    });

    await this.auditService.record({
      userId: sellerId,
      action: 'AUCTION_LISTING_CREATED',
      entityType: 'Auction',
      entityId: auction.id,
      newState: { status: initialStatus, title: auction.title },
    });

    return auction;
  }

  async submitForReview(auctionId: string, sellerId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.sellerId !== sellerId) throw new ForbiddenException('Not your listing');

    const editableStatuses: AuctionStatus[] = [
      AuctionStatus.DRAFT,
      AuctionStatus.ADDITIONAL_INFO_REQUIRED,
    ];
    if (!editableStatuses.includes(auction.status)) {
      throw new BadRequestException(`Cannot submit listing from status ${auction.status}`);
    }

    const nextStatus = auction.requiresInspection
      ? AuctionStatus.INSPECTION_REQUIRED
      : AuctionStatus.SUBMITTED;

    const updated = await this.prisma.auction.update({
      where: { id: auctionId },
      data: { status: nextStatus },
    });

    await this.auditService.record({
      userId: sellerId,
      action: 'AUCTION_SUBMITTED_FOR_APPROVAL',
      entityType: 'Auction',
      entityId: auctionId,
      previousState: { status: auction.status },
      newState: { status: nextStatus },
    });

    return updated;
  }

  /**
   * Prevent tampering with approved/active auctions
   */
  async updateDraftListing(auctionId: string, sellerId: string, dto: Partial<CreateAuctionDto>) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');
    if (auction.sellerId !== sellerId) throw new ForbiddenException('Not your listing');

    const mutableStatuses: AuctionStatus[] = [
      AuctionStatus.DRAFT,
      AuctionStatus.ADDITIONAL_INFO_REQUIRED,
    ];
    if (!mutableStatuses.includes(auction.status)) {
      throw new ForbiddenException(
        'Approved or active auctions cannot be edited directly. Contact an Auction Manager.',
      );
    }

    return this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        title: dto.title ?? auction.title,
        description: dto.description ?? auction.description,
        locationCity: dto.locationCity ?? auction.locationCity,
        startingPrice: dto.startingPrice ?? auction.startingPrice,
        currentHighestBid: dto.startingPrice ?? auction.currentHighestBid,
        bidIncrement: dto.bidIncrement ?? auction.bidIncrement,
        reservePrice: dto.reservePrice ?? auction.reservePrice,
      },
    });
  }

  /**
   * Centralized Governance Review (Auction Manager / Super Admin)
   */
  async reviewAuction(
    auctionId: string,
    reviewerId: string,
    payload: {
      status: AuctionStatus;
      reason?: string;
      startTime?: string;
      endTime?: string;
      requiresInspection?: boolean;
      requiresBidSecurity?: boolean;
    },
  ) {
    const existing = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!existing) throw new NotFoundException('Auction not found');

    const reasonRequiredStatuses: AuctionStatus[] = [
      AuctionStatus.REJECTED,
      AuctionStatus.PAUSED,
      AuctionStatus.CANCELLED,
      AuctionStatus.ADDITIONAL_INFO_REQUIRED,
    ];
    if (reasonRequiredStatuses.includes(payload.status) && (!payload.reason || !payload.reason.trim())) {
      throw new BadRequestException(`A documented reason is required when setting status to ${payload.status}`);
    }

    const isPublishing =
      payload.status === AuctionStatus.APPROVED ||
      payload.status === AuctionStatus.SCHEDULED ||
      payload.status === AuctionStatus.ACTIVE;

    const assignedCode =
      isPublishing && !existing.itemCode ? this.generateItemCode() : existing.itemCode;

    const newStartTime = payload.startTime ? new Date(payload.startTime) : existing.startTime;
    const newEndTime = payload.endTime ? new Date(payload.endTime) : existing.endTime;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.auction.update({
        where: { id: auctionId },
        data: {
          status: payload.status,
          itemCode: assignedCode,
          startTime: newStartTime,
          endTime: newEndTime,
          originalEndTime: payload.endTime ? newEndTime : existing.originalEndTime,
          requiresInspection:
            payload.requiresInspection !== undefined
              ? payload.requiresInspection
              : existing.requiresInspection,
          requiresBidSecurity:
            payload.requiresBidSecurity !== undefined
              ? payload.requiresBidSecurity
              : existing.requiresBidSecurity,
          approvalNotes: payload.reason || existing.approvalNotes,
          cancellationReason:
            payload.status === AuctionStatus.CANCELLED ? payload.reason : existing.cancellationReason,
          approvedById: isPublishing ? reviewerId : existing.approvedById,
          approvedAt: isPublishing ? new Date() : existing.approvedAt,
        },
      });

      await tx.auctionApproval.create({
        data: {
          auctionId,
          reviewerId,
          previousStatus: existing.status,
          newStatus: payload.status,
          decision: payload.status,
          reason: payload.reason || null,
        },
      });

      await tx.notification.create({
        data: {
          userId: existing.sellerId,
          title: isPublishing
            ? 'Listing Approved & Published'
            : `Listing Status Update: ${payload.status.replace(/_/g, ' ')}`,
          message: `Your listing "${existing.title}" moved to ${payload.status}.${
            payload.reason ? ` Notes: ${payload.reason}` : ''
          }`,
          type:
            payload.status === AuctionStatus.REJECTED
              ? NotificationType.LISTING_REJECTED
              : NotificationType.LISTING_APPROVED,
          linkUrl: `/auctions/${auctionId}`,
        },
      });

      return saved;
    });

    if (payload.status === AuctionStatus.ACTIVE || payload.status === AuctionStatus.SCHEDULED) {
      await this.redisService.setAuctionState(updated.id, {
        auctionId: updated.id,
        currentHighestBid: Number(updated.currentHighestBid),
        highestBidderId: updated.winningBidderId,
        highestBidderAlias: null,
        endTime: updated.endTime.getTime(),
        bidIncrement: Number(updated.bidIncrement),
        totalBidsCount: updated.totalBidsCount,
        status: updated.status,
      });
    }

    await this.auditService.record({
      userId: reviewerId,
      action: `AUCTION_GOVERNANCE_${payload.status}`,
      entityType: 'Auction',
      entityId: auctionId,
      previousState: { status: existing.status },
      newState: { status: payload.status, itemCode: assignedCode },
      reason: payload.reason || 'Governance action',
    });

    return updated;
  }

  async getGovernanceQueue() {
    return this.prisma.auction.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        images: { take: 1 },
        category: true,
        seller: {
          select: {
            id: true,
            email: true,
            profile: { select: { fullName: true, isKycVerified: true, verificationStatus: true } },
          },
        },
        inspectionRequests: {
          include: {
            report: { select: { id: true, reportCode: true, conditionGrade: true, adminReviewStatus: true } },
          },
        },
        _count: { select: { bids: true } },
      },
      take: 100,
    });
  }

  async applyForRestrictedAuction(auctionId: string, userId: string) {
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');

    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!profile?.isKycVerified) {
      throw new ForbiddenException('Identity verification is required before applying for restricted auctions');
    }

    return this.prisma.auctionParticipation.upsert({
      where: { auctionId_userId: { auctionId, userId } },
      update: { status: 'PENDING' },
      create: { auctionId, userId, status: 'PENDING' },
    });
  }

  async reviewParticipation(auctionId: string, userId: string, status: string, reviewerId: string) {
    const updated = await this.prisma.auctionParticipation.update({
      where: { auctionId_userId: { auctionId, userId } },
      data: { status },
    });
    await this.auditService.record({
      userId: reviewerId,
      action: 'RESTRICTED_AUCTION_PARTICIPATION_REVIEWED',
      entityType: 'AuctionParticipation',
      entityId: updated.id,
      newState: { auctionId, participantUserId: userId, status },
    });
    return updated;
  }

  /**
   * Public QR Verification endpoint (never exposes confidential seller/buyer details)
   */
  async getPublicQrVerification(itemCode: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { itemCode },
      include: {
        category: { select: { name: true, slug: true } },
        images: { orderBy: { displayOrder: 'asc' }, take: 3 },
        seller: {
          select: {
            profile: {
              select: {
                fullName: true,
                city: true,
                isKycVerified: true,
                verificationStatus: true,
              },
            },
          },
        },
        inspectionReports: {
          where: { adminReviewStatus: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            reportCode: true,
            conditionGrade: true,
            inspectionDate: true,
            inspectionLocation: true,
            observations: true,
            disclaimer: true,
            partner: { select: { companyName: true } },
          },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException(`No verified item found with code ${itemCode}`);
    }

    return {
      itemCode: auction.itemCode,
      auctionId: auction.id,
      title: auction.title,
      category: auction.category.name,
      condition: auction.condition,
      locationCity: auction.locationCity,
      status: auction.status,
      requiresBidSecurity: auction.requiresBidSecurity,
      isRestricted: auction.isRestricted,
      totalBidsCount: auction.totalBidsCount,
      currentHighestBid: Number(auction.currentHighestBid),
      startTime: auction.startTime,
      endTime: auction.endTime,
      coverImage: auction.images[0]?.url || null,
      sellerVerification: {
        displayName: auction.seller.profile?.fullName || 'Verified Merchant',
        city: auction.seller.profile?.city || 'Ethiopia',
        isKycVerified: !!auction.seller.profile?.isKycVerified,
      },
      approvedInspection: auction.inspectionReports[0] || null,
    };
  }

  async findAll(query: QueryAuctionsDto) {
    const page = query.page || 1;
    const limit = query.limit || 12;
    const skip = (page - 1) * limit;

    const where: any = {};
    const andConditions: any[] = [];

    if (query.status) {
      where.status = query.status;
    } else {
      where.status = { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED, AuctionStatus.SCHEDULED] };
    }

    if (query.category) {
      andConditions.push({
        OR: [{ categoryId: query.category }, { category: { slug: query.category } }],
      });
    }

    if (query.condition) {
      where.condition = query.condition;
    }

    if (query.city) {
      where.locationCity = { contains: query.city, mode: 'insensitive' };
    }

    if (query.minPrice || query.maxPrice) {
      where.currentHighestBid = {};
      if (query.minPrice) where.currentHighestBid.gte = query.minPrice;
      if (query.maxPrice) where.currentHighestBid.lte = query.maxPrice;
    }

    if (query.search) {
      andConditions.push({
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { description: { contains: query.search, mode: 'insensitive' } },
          { itemCode: { contains: query.search, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    let orderBy: any = { endTime: 'asc' };
    if (query.sortBy === 'newest') orderBy = { createdAt: 'desc' };
    if (query.sortBy === 'priceAsc') orderBy = { currentHighestBid: 'asc' };
    if (query.sortBy === 'priceDesc') orderBy = { currentHighestBid: 'desc' };
    if (query.sortBy === 'mostBids') orderBy = { totalBidsCount: 'desc' };

    const [total, auctions] = await Promise.all([
      this.prisma.auction.count({ where }),
      this.prisma.auction.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          images: { orderBy: { displayOrder: 'asc' } },
          category: true,
          seller: {
            select: {
              id: true,
              profile: { select: { fullName: true, isKycVerified: true, city: true, avatarUrl: true } },
            },
          },
          inspectionReports: {
            where: { adminReviewStatus: 'APPROVED' },
            take: 1,
            select: { reportCode: true, conditionGrade: true },
          },
          _count: {
            select: { bids: true, watchlist: true },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      items: auctions,
    };
  }

  async findOne(id: string, currentUserId?: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id },
      include: {
        images: { orderBy: { displayOrder: 'asc' } },
        category: true,
        bidSecurityPolicy: true,
        seller: {
          select: {
            id: true,
            profile: {
              select: {
                fullName: true,
                isKycVerified: true,
                city: true,
                avatarUrl: true,
                businessName: true,
              },
            },
          },
        },
        inspectionReports: {
          where: { adminReviewStatus: 'APPROVED' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            partner: { select: { companyName: true, contactName: true } },
          },
        },
        bids: {
          take: 15,
          orderBy: { placedAt: 'desc' },
          select: {
            id: true,
            amount: true,
            bidderAlias: true,
            isProxyBid: true,
            placedAt: true,
          },
        },
        _count: {
          select: { bids: true, watchlist: true },
        },
      },
    });

    if (!auction) {
      throw new NotFoundException(`Auction with ID ${id} not found`);
    }

    let isWatching = false;
    let userProxyBid: any = null;
    let userDeposit: any = null;
    let participationStatus: string | null = null;

    if (currentUserId) {
      const [watch, proxy, deposit, participation] = await Promise.all([
        this.prisma.watchlist.findUnique({
          where: { userId_auctionId: { userId: currentUserId, auctionId: id } },
        }),
        this.prisma.proxyBid.findUnique({
          where: { auctionId_bidderId: { auctionId: id, bidderId: currentUserId } },
        }),
        this.prisma.bidSecurityDeposit.findUnique({
          where: { buyerId_auctionId: { buyerId: currentUserId, auctionId: id } },
        }),
        this.prisma.auctionParticipation.findUnique({
          where: { auctionId_userId: { auctionId: id, userId: currentUserId } },
        }),
      ]);
      isWatching = !!watch;
      if (proxy && proxy.isActive) {
        userProxyBid = { maxAmount: Number(proxy.maxAmount), isActive: proxy.isActive };
      }
      if (deposit) {
        userDeposit = {
          id: deposit.id,
          amount: Number(deposit.amount),
          status: deposit.status,
          paymentProvider: deposit.paymentProvider,
          paymentReference: deposit.paymentReference,
        };
      }
      participationStatus = participation?.status || null;
    }

    const similarAuctions = await this.prisma.auction.findMany({
      where: {
        categoryId: auction.categoryId,
        id: { not: id },
        status: { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED] },
      },
      take: 3,
      orderBy: { endTime: 'asc' },
      include: {
        images: { orderBy: { displayOrder: 'asc' }, take: 1 },
        category: true,
        seller: {
          select: {
            id: true,
            profile: { select: { fullName: true, isKycVerified: true, city: true } },
          },
        },
      },
    });

    return {
      ...auction,
      isWatching,
      userProxyBid,
      userDeposit,
      participationStatus,
      similarAuctions,
    };
  }

  async reportAuction(userId: string, auctionId: string, reason: string, details?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A reason is required to submit a report');
    }
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) throw new NotFoundException('Auction not found');

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        auctionId,
        reason: reason.trim(),
        details: details?.trim() || null,
      },
    });

    await this.auditService.record({
      userId,
      action: 'AUCTION_REPORTED',
      entityType: 'Auction',
      entityId: auctionId,
      reason,
      metadata: { reportId: report.id },
    });

    return report;
  }

  async toggleWatchlist(userId: string, auctionId: string) {
    const existing = await this.prisma.watchlist.findUnique({
      where: { userId_auctionId: { userId, auctionId } },
    });

    if (existing) {
      await this.prisma.watchlist.delete({ where: { id: existing.id } });
      return { watching: false };
    } else {
      await this.prisma.watchlist.create({
        data: { userId, auctionId },
      });
      return { watching: true };
    }
  }

  async getSellerAuctions(sellerId: string) {
    return this.prisma.auction.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: {
        images: { take: 1 },
        category: true,
        inspectionRequests: {
          include: {
            report: { select: { reportCode: true, conditionGrade: true, adminReviewStatus: true } },
          },
        },
        _count: { select: { bids: true } },
      },
    });
  }

  async getBuyerBids(buyerId: string) {
    return this.prisma.bid.findMany({
      where: { bidderId: buyerId },
      orderBy: { placedAt: 'desc' },
      distinct: ['auctionId'],
      include: {
        auction: {
          include: {
            images: { take: 1 },
            category: true,
          },
        },
      },
    });
  }

  async getBuyerWatchlist(userId: string) {
    const items = await this.prisma.watchlist.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
      include: {
        auction: {
          include: {
            images: { take: 1 },
            category: true,
          },
        },
      },
    });
    return items.map((w) => w.auction);
  }

  async getBuyerWonAuctions(userId: string) {
    return this.prisma.auction.findMany({
      where: {
        winningBidderId: userId,
        status: { in: [AuctionStatus.ENDED, AuctionStatus.COMPLETED] },
      },
      include: {
        images: { take: 1 },
        category: true,
        transaction: true,
      },
      orderBy: { endTime: 'desc' },
    });
  }

  async updateAuctionStatus(auctionId: string, status: AuctionStatus, reviewerId?: string, reason?: string) {
    return this.reviewAuction(auctionId, reviewerId || 'SYSTEM', { status, reason });
  }
}
