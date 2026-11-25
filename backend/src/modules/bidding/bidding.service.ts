import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { ProxyBiddingService } from './proxy-bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { AuctionStatus, NotificationType } from '@prisma/client';

export interface OutbidNotificationPayload {
  userId: string;
  notification: {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    linkUrl: string;
    createdAt: string;
  };
}

export interface BidResult {
  success: boolean;
  bidId: string;
  auctionId: string;
  amount: number;
  bidderAlias: string;
  placedAt: string;
  newEndTime: string;
  antiSnipingExtended: boolean;
  proxyCounterTriggered: boolean;
  proxyWinningAmount?: number;
  proxyWinningAlias?: string;
  outbidNotifications?: OutbidNotificationPayload[];
}

@Injectable()
export class BiddingService {
  private readonly logger = new Logger(BiddingService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private proxyBiddingService: ProxyBiddingService,
  ) {}

  /**
   * Atomic Bid Placement with Redis Distributed Lock, Anti-Sniping, and Proxy Evaluation
   */
  async placeBid(userId: string, dto: PlaceBidDto, ipAddress?: string): Promise<BidResult> {
    const { auctionId, amount } = dto;
    const lockKey = `auction:${auctionId}`;

    // 1. Acquire Distributed Lock (2-second TTL)
    const { acquired, token } = await this.redisService.acquireLock(lockKey, 2500);
    if (!acquired) {
      throw new ConflictException('Another bid is currently being processed. Please retry in a moment.');
    }

    try {
      // 2. Fetch Auction from DB with Row-level Lock consideration
      const auction = await this.prisma.auction.findUnique({
        where: { id: auctionId },
        include: {
          seller: { select: { id: true } },
        },
      });

      if (!auction) {
        throw new NotFoundException('Auction not found');
      }

      // 3. Server-Controlled Validation Checks
      if (auction.status !== AuctionStatus.ACTIVE && auction.status !== AuctionStatus.EXTENDED) {
        throw new BadRequestException(`Auction is not active. Current status: ${auction.status}`);
      }

      const now = new Date();
      if (now >= auction.endTime) {
        // Mark as ENDED if past endTime
        await this.prisma.auction.update({
          where: { id: auctionId },
          data: { status: AuctionStatus.ENDED },
        });
        throw new BadRequestException('Auction has already concluded');
      }

      if (auction.sellerId === userId) {
        throw new ForbiddenException('Sellers cannot place bids on their own listings');
      }

      if (auction.winningBidderId === userId) {
        throw new BadRequestException('You are already the current highest bidder');
      }

      // 3b. Restricted Auction Eligibility Check
      if ((auction as any).isRestricted) {
        const participation = await this.prisma.auctionParticipation?.findUnique({
          where: { auctionId_userId: { auctionId, userId } },
        });
        if (!participation || participation.status !== 'APPROVED') {
          throw new ForbiddenException(
            'This is a restricted auction. You must apply and receive approval before bidding.',
          );
        }
      }

      // 3c. Bid Security Deposit Eligibility Check
      if ((auction as any).requiresBidSecurity) {
        const deposit = await this.prisma.bidSecurityDeposit?.findUnique({
          where: { buyerId_auctionId: { buyerId: userId, auctionId } },
        });
        if (!deposit || (deposit.status !== 'CONFIRMED' && deposit.status !== 'RESERVED')) {
          throw new ForbiddenException(
            'A confirmed bid security deposit is required before placing bids on this auction.',
          );
        }
      }

      const currentHighest = Number(auction.currentHighestBid);
      const increment = Number(auction.bidIncrement);
      const minRequiredBid = currentHighest + increment;

      if (amount < minRequiredBid) {
        throw new BadRequestException(
          `Bid amount (ETB ${amount.toLocaleString()}) must be at least the required minimum of ETB ${minRequiredBid.toLocaleString()} (current highest: ETB ${currentHighest.toLocaleString()} + increment: ETB ${increment.toLocaleString()})`,
        );
      }

      // 4. Anti-Sniping Soft-Close Extension
      // If submitted within the final 30 seconds of the auction
      const timeRemainingMs = auction.endTime.getTime() - now.getTime();
      let antiSnipingExtended = false;
      let finalEndTime = auction.endTime;
      let newExtensionCount = auction.antiSnipingExtensions;

      if (timeRemainingMs <= 30000) {
        // Extend auction by 30 seconds
        finalEndTime = new Date(finalEndTime.getTime() + 30000);
        newExtensionCount += 1;
        antiSnipingExtended = true;
        this.logger.log(
          `[Anti-Sniping] Auction ${auctionId} extended by 30s. New end time: ${finalEndTime.toISOString()}`,
        );
      }

      // 5. Generate Dynamic Pseudonym for Bidder Privacy in Public Rooms
      const shortId = userId.substring(userId.length - 4);
      const alias = `Bidder #${shortId.toUpperCase()}`;

      // 6. Persist Bid Record in Transaction
      const [newBid] = await this.prisma.$transaction([
        this.prisma.bid.create({
          data: {
            auctionId,
            bidderId: userId,
            amount,
            bidderAlias: alias,
            isProxyBid: false,
            ipAddress: ipAddress || null,
          },
        }),
        this.prisma.auction.update({
          where: { id: auctionId },
          data: {
            currentHighestBid: amount,
            winningBidderId: userId,
            endTime: finalEndTime,
            antiSnipingExtensions: newExtensionCount,
            status: antiSnipingExtended ? AuctionStatus.EXTENDED : auction.status,
            totalBidsCount: { increment: 1 },
          },
        }),
      ]);

      // 7. Update Redis In-Memory State
      const previousWinnerId = auction.winningBidderId;
      let activeHighestBid = amount;
      let activeWinningBidderId = userId;
      let activeWinningAlias = alias;

      // 8. Trigger Automatic Proxy Counter-Bidding Evaluation
      const proxyResult = await this.proxyBiddingService.evaluateProxyBids(
        auctionId,
        amount,
        userId,
        increment,
      );

      if (proxyResult.triggered && proxyResult.newHighestBid) {
        activeHighestBid = proxyResult.newHighestBid;
        activeWinningBidderId = proxyResult.newBidderId!;
        activeWinningAlias = proxyResult.newBidderAlias!;
      }

      // 8b. Record Audit Log & Outbid Notifications
      const outbidNotifications: OutbidNotificationPayload[] = [];
      try {
        await this.prisma.auditLog?.create({
          data: {
            userId,
            action: antiSnipingExtended ? 'BID_PLACED_AND_EXTENDED' : 'BID_PLACED',
            entityType: 'Auction',
            entityId: auctionId,
            ipAddress: ipAddress || null,
            metadata: JSON.stringify({
              bidId: newBid.id,
              submittedAmount: amount,
              finalHighestBid: activeHighestBid,
              proxyTriggered: proxyResult.triggered,
              antiSnipingExtended,
            }),
          },
        });

        const outbidTargets = new Set<string>();
        if (previousWinnerId && previousWinnerId !== activeWinningBidderId) {
          outbidTargets.add(previousWinnerId);
        }
        if (proxyResult.triggered && activeWinningBidderId !== userId) {
          outbidTargets.add(userId);
        }

        for (const targetUserId of outbidTargets) {
          const notif = await this.prisma.notification?.create({
            data: {
              userId: targetUserId,
              title: 'You have been outbid!',
              message: `A higher bid of ETB ${activeHighestBid.toLocaleString()} was placed on "${auction.title}".`,
              type: NotificationType.OUTBID,
              linkUrl: `/auctions/${auctionId}`,
            },
          });
          if (notif) {
            outbidNotifications.push({
              userId: targetUserId,
              notification: {
                id: notif.id,
                title: notif.title,
                message: notif.message,
                type: notif.type,
                linkUrl: notif.linkUrl || `/auctions/${auctionId}`,
                createdAt: notif.createdAt.toISOString(),
              },
            });
          }
        }
      } catch (logErr) {
        this.logger.warn(`Non-fatal audit/notification write warning: ${(logErr as Error).message}`);
      }

      await this.redisService.setAuctionState(auctionId, {
        auctionId,
        currentHighestBid: activeHighestBid,
        highestBidderId: activeWinningBidderId,
        highestBidderAlias: activeWinningAlias,
        endTime: finalEndTime.getTime(),
        bidIncrement: increment,
        totalBidsCount: auction.totalBidsCount + (proxyResult.triggered ? 2 : 1),
        status: antiSnipingExtended ? AuctionStatus.EXTENDED : auction.status,
      });

      return {
        success: true,
        bidId: newBid.id,
        auctionId,
        amount: activeHighestBid,
        bidderAlias: activeWinningAlias,
        placedAt: newBid.placedAt.toISOString(),
        newEndTime: finalEndTime.toISOString(),
        antiSnipingExtended,
        proxyCounterTriggered: proxyResult.triggered,
        proxyWinningAmount: proxyResult.newHighestBid,
        proxyWinningAlias: proxyResult.newBidderAlias,
        outbidNotifications,
      };
    } finally {
      // 9. Always Release Distributed Lock
      await this.redisService.releaseLock(lockKey, token);
    }
  }

  async getRecentBids(auctionId: string, limit = 20) {
    return this.prisma.bid.findMany({
      where: { auctionId },
      orderBy: { placedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        amount: true,
        bidderAlias: true,
        isProxyBid: true,
        placedAt: true,
      },
    });
  }
}
