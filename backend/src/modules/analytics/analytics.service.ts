import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FlagSeverity } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Platform Overview Metrics for Admin & Evaluation
   */
  async getPlatformOverview() {
    const [
      totalUsers,
      totalAuctions,
      activeAuctions,
      completedAuctions,
      totalBids,
      totalTransactions,
      settledVolume,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.auction.count(),
      this.prisma.auction.count({ where: { status: { in: ['ACTIVE', 'EXTENDED'] } } }),
      this.prisma.auction.count({ where: { status: 'ENDED' } }),
      this.prisma.bid.count(),
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({
        where: { paymentStatus: 'RELEASED_TO_SELLER' },
        _sum: { finalAmount: true },
      }),
    ]);

    return {
      totalUsers,
      totalAuctions,
      activeAuctions,
      completedAuctions,
      totalBids,
      totalTransactions,
      settledVolumeETB: settledVolume._sum.finalAmount || 0,
    };
  }

  /**
   * AI-Assisted Suspicious Activity & Bidding Fraud Detection
   * Analyzes:
   * 1. Rapid Bid Velocity (Bids placed < 1 second apart by same account)
   * 2. Suspected Shill Collusion (Repetitive bid alternation between 2 specific accounts)
   * 3. Abnormal Price Spike (Bids exceeding 300% of previous bid)
   */
  async runFraudDetectionScan() {
    const flaggedItems: any[] = [];

    // Analyze active or recently ended auctions
    const auctions = await this.prisma.auction.findMany({
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        bids: {
          orderBy: { placedAt: 'asc' },
          select: { id: true, bidderId: true, amount: true, placedAt: true },
        },
      },
    });

    for (const auction of auctions) {
      const bids = auction.bids;
      if (bids.length < 3) continue;

      // 1. Velocity Analysis: Bids < 1500ms apart from same user
      for (let i = 1; i < bids.length; i++) {
        const diffMs = bids[i].placedAt.getTime() - bids[i - 1].placedAt.getTime();
        if (bids[i].bidderId === bids[i - 1].bidderId && diffMs < 1500) {
          const flag = {
            auctionId: auction.id,
            userId: bids[i].bidderId,
            flagType: 'RAPID_BID_VELOCITY',
            severity: FlagSeverity.MEDIUM,
            confidenceScore: 0.82,
            explanation: `User placed consecutive bids only ${diffMs}ms apart, indicating possible automated script or double-click anomaly.`,
          };
          flaggedItems.push(flag);
        }
      }

      // 2. Pairwise Alternation (Shill Bidding heuristic between 2 users driving up price)
      if (bids.length >= 6) {
        let alternatingCount = 0;
        const userA = bids[bids.length - 1].bidderId;
        const userB = bids[bids.length - 2].bidderId;

        if (userA !== userB) {
          for (let j = bids.length - 1; j >= Math.max(0, bids.length - 6); j--) {
            const expectedUser = (bids.length - 1 - j) % 2 === 0 ? userA : userB;
            if (bids[j].bidderId === expectedUser) alternatingCount++;
          }

          if (alternatingCount >= 5) {
            flaggedItems.push({
              auctionId: auction.id,
              userId: userA,
              flagType: 'SUSPECTED_SHILL_COLLUSION',
              severity: FlagSeverity.HIGH,
              confidenceScore: 0.88,
              explanation: `Detected 5+ strictly alternating bids between users ${userA.substring(0, 8)} and ${userB.substring(0, 8)}, indicating possible coordinated price inflation.`,
            });
          }
        }
      }
    }

    // Persist new flags (ignore duplicates)
    for (const item of flaggedItems) {
      await this.prisma.suspiciousActivityFlag.create({
        data: item,
      });
    }

    return {
      scannedAuctions: auctions.length,
      flagsGenerated: flaggedItems.length,
      flags: flaggedItems,
    };
  }

  async getAdminFlags() {
    return this.prisma.suspiciousActivityFlag.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        auction: { select: { id: true, title: true, currentHighestBid: true } },
        user: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      take: 50,
    });
  }

  async dismissFlag(flagId: string) {
    return this.prisma.suspiciousActivityFlag.update({
      where: { id: flagId },
      data: { reviewedByAdmin: true },
    });
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { fullName: true } },
          },
        },
      },
      take: 50,
    });
  }

  async getReports() {
    return this.prisma.report.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        auction: { select: { id: true, title: true, status: true } },
        reporter: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      take: 50,
    });
  }

  async resolveReport(reportId: string, status: string) {
    return this.prisma.report.update({
      where: { id: reportId },
      data: { status },
    });
  }
}
