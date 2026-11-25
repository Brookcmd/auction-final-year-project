import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ProxyEvaluationResult {
  triggered: boolean;
  newHighestBid?: number;
  newBidderId?: string;
  newBidderAlias?: string;
  isProxy?: boolean;
}

@Injectable()
export class ProxyBiddingService {
  private readonly logger = new Logger(ProxyBiddingService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Set or update maximum proxy bid limit for a user.
   */
  async setProxyBid(userId: string, auctionId: string, maxAmount: number) {
    return this.prisma.proxyBid.upsert({
      where: {
        auctionId_bidderId: {
          auctionId,
          bidderId: userId,
        },
      },
      update: {
        maxAmount,
        isActive: true,
      },
      create: {
        auctionId,
        bidderId: userId,
        maxAmount,
        isActive: true,
      },
    });
  }

  /**
   * Evaluate active competing proxy bids on an auction following a new bid.
   * Runs inside the auction's distributed lock to maintain consistency.
   */
  async evaluateProxyBids(
    auctionId: string,
    currentHighestBid: number,
    currentHighestBidderId: string,
    bidIncrement: number,
  ): Promise<ProxyEvaluationResult> {
    // Find active proxy bids by other bidders whose max is greater than the current highest bid
    const eligibleProxies = await this.prisma.proxyBid.findMany({
      where: {
        auctionId,
        isActive: true,
        bidderId: { not: currentHighestBidderId },
        maxAmount: { gt: currentHighestBid },
      },
      orderBy: { maxAmount: 'desc' },
      take: 2, // Check top 2 contenders
    });

    if (eligibleProxies.length === 0) {
      return { triggered: false };
    }

    const topProxy = eligibleProxies[0];
    const topMax = Number(topProxy.maxAmount);

    // Calculate required next minimum bid
    const nextMinimum = currentHighestBid + bidIncrement;

    if (topMax < nextMinimum) {
      // Top proxy cannot even satisfy the minimum increment
      return { triggered: false };
    }

    // Determine the counter-bid amount
    let counterBidAmount: number;

    if (eligibleProxies.length > 1) {
      // Competing proxy battle
      const secondProxy = eligibleProxies[1];
      const secondMax = Number(secondProxy.maxAmount);

      if (topMax === secondMax) {
        // Tie breaker: topMax was set earlier or wins, sets amount to topMax
        counterBidAmount = topMax;
      } else {
        // Sets amount to secondMax + increment, capped by topMax
        counterBidAmount = Math.min(topMax, secondMax + bidIncrement);
      }
    } else {
      // Only one active proxy competing against the manual current bidder
      counterBidAmount = nextMinimum;
    }

    // Generate pseudonym alias for the proxy bidder
    const shortId = topProxy.bidderId.substring(topProxy.bidderId.length - 4);
    const alias = `Bidder #${shortId.toUpperCase()}`;

    // Record the automated counter-bid
    await this.prisma.bid.create({
      data: {
        auctionId,
        bidderId: topProxy.bidderId,
        amount: counterBidAmount,
        bidderAlias: alias,
        isProxyBid: true,
      },
    });

    // Update auction current highest bid
    await this.prisma.auction.update({
      where: { id: auctionId },
      data: {
        currentHighestBid: counterBidAmount,
        winningBidderId: topProxy.bidderId,
        totalBidsCount: { increment: 1 },
      },
    });

    this.logger.log(
      `[Proxy Bidding] Auction ${auctionId}: User ${topProxy.bidderId} auto counter-bid ETB ${counterBidAmount}`,
    );

    return {
      triggered: true,
      newHighestBid: counterBidAmount,
      newBidderId: topProxy.bidderId,
      newBidderAlias: alias,
      isProxy: true,
    };
  }
}
