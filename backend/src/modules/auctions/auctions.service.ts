import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { QueryAuctionsDto } from './dto/query-auctions.dto';
import { AuctionStatus, Role } from '@prisma/client';

@Injectable()
export class AuctionsService {
  private readonly logger = new Logger(AuctionsService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async create(sellerId: string, dto: CreateAuctionDto) {
    const startTime = new Date(dto.startTime);
    const endTime = new Date(dto.endTime);

    if (endTime <= startTime) {
      throw new BadRequestException('Auction end time must be after start time');
    }

    const now = new Date();
    // If start time is now or in the past, and user is seller, set to ACTIVE or PENDING_REVIEW
    const initialStatus = AuctionStatus.ACTIVE;

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

    // Seed state in Redis cache
    await this.redisService.setAuctionState(auction.id, {
      auctionId: auction.id,
      currentHighestBid: Number(auction.currentHighestBid),
      highestBidderId: null,
      highestBidderAlias: null,
      endTime: auction.endTime.getTime(),
      bidIncrement: Number(auction.bidIncrement),
      totalBidsCount: 0,
      status: auction.status,
    });

    return auction;
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
      where.status = { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED] };
    }

    if (query.category) {
      andConditions.push({
        OR: [
          { categoryId: query.category },
          { category: { slug: query.category } },
        ],
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
        seller: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phoneNumber: true,
                isKycVerified: true,
                city: true,
                avatarUrl: true,
              },
            },
          },
        },
        bids: {
          take: 10,
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

    // Check if watching & active proxy bid for user
    let isWatching = false;
    let userProxyBid: any = null;

    if (currentUserId) {
      const [watch, proxy] = await Promise.all([
        this.prisma.watchlist.findUnique({
          where: { userId_auctionId: { userId: currentUserId, auctionId: id } },
        }),
        this.prisma.proxyBid.findUnique({
          where: { auctionId_bidderId: { auctionId: id, bidderId: currentUserId } },
        }),
      ]);
      isWatching = !!watch;
      if (proxy && proxy.isActive) {
        userProxyBid = { maxAmount: Number(proxy.maxAmount), isActive: proxy.isActive };
      }
    }

    // Fetch similar active auctions in the same category
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
      similarAuctions,
    };
  }

  async reportAuction(userId: string, auctionId: string, reason: string, details?: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A reason is required to submit a report');
    }
    const auction = await this.prisma.auction.findUnique({ where: { id: auctionId } });
    if (!auction) {
      throw new NotFoundException('Auction not found');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: userId,
        auctionId,
        reason: reason.trim(),
        details: details?.trim() || null,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'AUCTION_REPORTED',
        entityType: 'Auction',
        entityId: auctionId,
        metadata: JSON.stringify({ reportId: report.id, reason }),
      },
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
        status: AuctionStatus.ENDED,
      },
      include: {
        images: { take: 1 },
        category: true,
        transaction: true,
      },
      orderBy: { endTime: 'desc' },
    });
  }

  // Admin moderation
  async updateAuctionStatus(auctionId: string, status: AuctionStatus) {
    return this.prisma.auction.update({
      where: { id: auctionId },
      data: { status },
    });
  }
}
