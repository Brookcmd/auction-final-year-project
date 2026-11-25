import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BiddingGateway } from '../bidding/bidding.gateway';
import { AuctionStatus, NotificationType, PaymentStatus, DeliveryStatus, PaymentProvider } from '@prisma/client';

@Injectable()
export class AuctionTimerService {
  private readonly logger = new Logger(AuctionTimerService.name);

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private biddingGateway: BiddingGateway,
  ) {}

  /**
   * Run every 10 seconds to detect expired auctions, finalize winners,
   * create transaction escrow records, and notify participants.
   */
  @Cron('*/10 * * * * *')
  async checkAuctionExpirations() {
    try {
      const now = new Date();

      const expiredAuctions = await this.prisma.auction.findMany({
        where: {
          status: { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED] },
          endTime: { lte: now },
        },
        include: {
          winningBidder: { select: { id: true, email: true } },
          seller: { select: { id: true, email: true } },
        },
      });

      if (expiredAuctions.length === 0) return;

      for (const auction of expiredAuctions) {
        try {
          await this.finalizeAuction(auction);
        } catch (err) {
          this.logger.error(`Error finalizing auction ${auction.id}: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Skipping auction expiration check (database unreachable): ${err.message}`);
    }
  }

  private async finalizeAuction(auction: any) {
    const finalStatus = AuctionStatus.ENDED;

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark auction as ENDED
      await tx.auction.update({
        where: { id: auction.id },
        data: { status: finalStatus },
      });

      // 2. If winner exists, initialize settlement transaction
      if (auction.winningBidderId) {
        // Create Transaction
        await tx.transaction.create({
          data: {
            auctionId: auction.id,
            buyerId: auction.winningBidderId,
            sellerId: auction.sellerId,
            finalAmount: auction.currentHighestBid,
            paymentStatus: PaymentStatus.PENDING,
            deliveryStatus: DeliveryStatus.PENDING,
            paymentProvider: PaymentProvider.TELEBIRR,
          },
        });

        // Notify Buyer
        await tx.notification.create({
          data: {
            userId: auction.winningBidderId,
            title: '🎉 You Won an Auction!',
            message: `Congratulations! You won the auction for "${auction.title}" with a final bid of ETB ${Number(auction.currentHighestBid).toLocaleString()}. Please proceed to complete payment.`,
            type: NotificationType.AUCTION_WON,
            linkUrl: `/dashboard/won-auctions`,
          },
        });

        // Notify Seller
        await tx.notification.create({
          data: {
            userId: auction.sellerId,
            title: '🏁 Auction Completed',
            message: `Your listing "${auction.title}" has successfully ended with a winning bid of ETB ${Number(auction.currentHighestBid).toLocaleString()}.`,
            type: NotificationType.AUCTION_ENDING,
            linkUrl: `/dashboard/seller`,
          },
        });
      }
    });

    // 3. Broadcast real-time event to connected room
    this.biddingGateway.server?.to(`auction:${auction.id}`).emit('auction_ended', {
      auctionId: auction.id,
      winningBid: Number(auction.currentHighestBid),
      winnerId: auction.winningBidderId,
      status: finalStatus,
    });

    this.logger.log(`Finalized auction ${auction.id} - Winner: ${auction.winningBidderId || 'None'}`);
  }
}
