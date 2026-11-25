import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { BiddingGateway } from '../bidding/bidding.gateway';
import {
  AuctionStatus,
  DeliveryStatus,
  DepositStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  TransactionWorkflowStatus,
} from '@prisma/client';

@Injectable()
export class AuctionTimerService {
  private readonly logger = new Logger(AuctionTimerService.name);

  constructor(
    private prisma: PrismaService,
    private biddingGateway: BiddingGateway,
  ) {}

  /**
   * Run every 10 seconds to detect expired auctions, finalize winners,
   * generate transactions, mark non-winner deposits refund-eligible, and notify participants.
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
          this.logger.error(`Error finalizing auction ${auction.id}: ${(err as Error).message}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Skipping auction expiration check (database unreachable): ${(err as Error).message}`);
    }
  }

  private async finalizeAuction(auction: any) {
    const finalStatus = AuctionStatus.ENDED;
    const now = new Date();
    const paymentDeadline = new Date(now.getTime() + 72 * 60 * 60 * 1000);
    const agreementNumber = `AGR-${now.getFullYear()}-${auction.id.substring(0, 6).toUpperCase()}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.auction.update({
        where: { id: auction.id },
        data: { status: finalStatus },
      });

      // Mark non-winning bidders' confirmed bid security deposits as refund-pending
      const nonWinnerDeposits = await tx.bidSecurityDeposit.findMany({
        where: {
          auctionId: auction.id,
          status: DepositStatus.CONFIRMED,
          ...(auction.winningBidderId ? { buyerId: { not: auction.winningBidderId } } : {}),
        },
      });

      for (const dep of nonWinnerDeposits) {
        await tx.bidSecurityDeposit.update({
          where: { id: dep.id },
          data: { status: DepositStatus.REFUND_PENDING },
        });
        await tx.notification.create({
          data: {
            userId: dep.buyerId,
            title: 'Bid Security Eligible for Refund',
            message: `Auction "${auction.title}" has closed. Your simulated bid security deposit is queued for Finance review and refund.`,
            type: NotificationType.DEPOSIT_UPDATE,
            linkUrl: '/dashboard/buyer',
          },
        });
      }

      if (auction.winningBidderId) {
        const winningDeposit = await tx.bidSecurityDeposit.findUnique({
          where: {
            buyerId_auctionId: {
              buyerId: auction.winningBidderId,
              auctionId: auction.id,
            },
          },
        });

        let appliedDeposit = 0;
        if (winningDeposit && winningDeposit.status === DepositStatus.CONFIRMED) {
          appliedDeposit = Number(winningDeposit.amount);
          await tx.bidSecurityDeposit.update({
            where: { id: winningDeposit.id },
            data: { status: DepositStatus.RESERVED },
          });
        }

        const finalAmount = Number(auction.currentHighestBid);
        const platformFeeETB = Math.round(finalAmount * 0.025);

        await tx.transaction.create({
          data: {
            agreementNumber,
            auctionId: auction.id,
            buyerId: auction.winningBidderId,
            sellerId: auction.sellerId,
            finalAmount,
            platformFeeETB,
            appliedDepositETB: appliedDeposit,
            paymentStatus: PaymentStatus.PENDING,
            workflowStatus: TransactionWorkflowStatus.AWAITING_PAYMENT,
            deliveryStatus: DeliveryStatus.NOT_SCHEDULED,
            paymentProvider: PaymentProvider.TELEBIRR,
            paymentDeadline,
          },
        });

        await tx.notification.create({
          data: {
            userId: auction.winningBidderId,
            title: 'You Won an Auction!',
            message: `Congratulations! You won "${auction.title}" at ETB ${finalAmount.toLocaleString()}. Complete simulated payment before ${paymentDeadline.toLocaleDateString()}.`,
            type: NotificationType.AUCTION_WON,
            linkUrl: '/dashboard/buyer',
          },
        });

        await tx.notification.create({
          data: {
            userId: auction.sellerId,
            title: 'Auction Completed',
            message: `Your listing "${auction.title}" closed with winning bid ETB ${finalAmount.toLocaleString()} (Agreement ${agreementNumber}).`,
            type: NotificationType.AUCTION_COMPLETED,
            linkUrl: '/dashboard/seller',
          },
        });
      }
    });

    this.biddingGateway.server?.to(`auction:${auction.id}`).emit('auction_ended', {
      auctionId: auction.id,
      winningBid: Number(auction.currentHighestBid),
      winnerId: auction.winningBidderId,
      status: finalStatus,
    });

    this.biddingGateway.server?.emit('marketplace_auction_ended', {
      auctionId: auction.id,
      status: finalStatus,
    });

    this.logger.log(`Finalized auction ${auction.id} - Winner: ${auction.winningBidderId || 'None'}`);
  }
}
