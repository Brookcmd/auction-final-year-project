import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { AuctionStatus, DepositStatus, DisputeStatus, FlagSeverity, Role, VerificationStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  /**
   * Comprehensive Platform Overview Metrics (Clearly separating simulated transactions from real revenue)
   */
  async getPlatformOverview() {
    const [
      totalUsers,
      verifiedBuyers,
      verifiedSellers,
      pendingVerifications,
      totalAuctions,
      activeAuctions,
      pendingAuctionApprovals,
      completedAuctions,
      totalBids,
      totalTransactions,
      simulatedVolume,
      totalDeposits,
      pendingRefunds,
      activeDisputes,
      approvedInspectors,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.BUYER, profile: { isKycVerified: true } } }),
      this.prisma.user.count({ where: { role: Role.SELLER, profile: { isKycVerified: true } } }),
      this.prisma.verificationRequest.count({
        where: { status: { in: [VerificationStatus.PENDING, VerificationStatus.PENDING_REVIEW] } },
      }),
      this.prisma.auction.count(),
      this.prisma.auction.count({ where: { status: { in: [AuctionStatus.ACTIVE, AuctionStatus.EXTENDED] } } }),
      this.prisma.auction.count({
        where: {
          status: {
            in: [
              AuctionStatus.SUBMITTED,
              AuctionStatus.PENDING_REVIEW,
              AuctionStatus.UNDER_REVIEW,
              AuctionStatus.INSPECTION_COMPLETED,
            ],
          },
        },
      }),
      this.prisma.auction.count({ where: { status: { in: [AuctionStatus.ENDED, AuctionStatus.COMPLETED] } } }),
      this.prisma.bid.count(),
      this.prisma.transaction.count(),
      this.prisma.transaction.aggregate({
        _sum: { finalAmount: true },
      }),
      this.prisma.bidSecurityDeposit.aggregate({
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.bidSecurityDeposit.count({
        where: { status: DepositStatus.REFUND_PENDING },
      }),
      this.prisma.dispute.count({
        where: { status: { in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW, DisputeStatus.ESCALATED, DisputeStatus.APPEALED] } },
      }),
      this.prisma.inspectionPartner.count({ where: { approvalStatus: 'APPROVED' } }),
    ]);

    return {
      totalUsers,
      verifiedBuyers,
      verifiedSellers,
      pendingVerifications,
      totalAuctions,
      activeAuctions,
      pendingAuctionApprovals,
      completedAuctions,
      totalBids,
      totalTransactions,
      // Explicitly marked as simulated prototype volume (not real revenue)
      simulatedTransactionVolumeETB: Number(simulatedVolume._sum.finalAmount || 0),
      settledVolumeETB: Number(simulatedVolume._sum.finalAmount || 0),
      simulatedDepositsCount: totalDeposits._count,
      simulatedDepositsTotalETB: Number(totalDeposits._sum.amount || 0),
      pendingRefunds,
      activeDisputes,
      approvedInspectors,
    };
  }

  /**
   * Detailed Category, Success Rate, Deposit & Risk Analytics
   */
  async getDetailedAnalytics() {
    const categories = await this.prisma.category.findMany({
      include: {
        auctions: {
          select: { status: true, currentHighestBid: true, totalBidsCount: true },
        },
      },
    });

    const byCategory = categories.map((c) => {
      const count = c.auctions.length;
      const completed = c.auctions.filter(
        (a) => a.status === AuctionStatus.ENDED || a.status === AuctionStatus.COMPLETED,
      );
      const avgWinningPrice =
        completed.length > 0
          ? completed.reduce((acc, a) => acc + Number(a.currentHighestBid), 0) / completed.length
          : 0;
      return {
        category: c.name,
        slug: c.slug,
        totalAuctions: count,
        completedAuctions: completed.length,
        avgWinningPriceETB: Math.round(avgWinningPrice),
      };
    });

    const [totalAuctions, successfulAuctions, depositsByStatus, flagsBySeverity] = await Promise.all([
      this.prisma.auction.count({ where: { status: { in: [AuctionStatus.ENDED, AuctionStatus.COMPLETED] } } }),
      this.prisma.auction.count({
        where: {
          status: { in: [AuctionStatus.ENDED, AuctionStatus.COMPLETED] },
          winningBidderId: { not: null },
        },
      }),
      this.prisma.bidSecurityDeposit.groupBy({
        by: ['status'],
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.suspiciousActivityFlag.groupBy({
        by: ['severity'],
        _count: true,
      }),
    ]);

    return {
      byCategory,
      auctionSuccessRatePercent:
        totalAuctions > 0 ? Math.round((successfulAuctions / totalAuctions) * 100) : 0,
      depositsBreakdown: depositsByStatus.map((d) => ({
        status: d.status,
        count: d._count,
        amountETB: Number(d._sum.amount || 0),
      })),
      riskBreakdown: flagsBySeverity.map((r) => ({
        severity: r.severity,
        count: r._count,
      })),
    };
  }

  /**
   * Rule-Based Explainable AI-Assisted Risk Detection Engine
   * Assists administrators only; preserves evidence; never auto-bans users.
   */
  async runFraudDetectionScan() {
    const flaggedItems: any[] = [];

    const auctions = await this.prisma.auction.findMany({
      take: 30,
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
      if (bids.length < 2) continue;

      // 1. Rapid Bid Velocity (< 1.5s apart by same user)
      for (let i = 1; i < bids.length; i++) {
        const diffMs = bids[i].placedAt.getTime() - bids[i - 1].placedAt.getTime();
        if (bids[i].bidderId === bids[i - 1].bidderId && diffMs < 1500) {
          flaggedItems.push({
            auctionId: auction.id,
            userId: bids[i].bidderId,
            flagType: 'RAPID_BID_VELOCITY',
            severity: FlagSeverity.MEDIUM,
            confidenceScore: 0.82,
            explanation: `Rule match: consecutive bids placed ${diffMs}ms apart by the same bidder.`,
            evidenceJson: JSON.stringify({ bidIds: [bids[i - 1].id, bids[i].id], diffMs }),
          });
        }

        // 2. Sudden Abnormal Price Spike (> 200% jump in a single step)
        const prevAmount = Number(bids[i - 1].amount);
        const currAmount = Number(bids[i].amount);
        if (prevAmount > 0 && currAmount >= prevAmount * 3) {
          flaggedItems.push({
            auctionId: auction.id,
            userId: bids[i].bidderId,
            flagType: 'ABNORMAL_PRICE_SPIKE',
            severity: FlagSeverity.HIGH,
            confidenceScore: 0.79,
            explanation: `Rule match: single bid jumped from ETB ${prevAmount.toLocaleString()} to ETB ${currAmount.toLocaleString()} (>= 300%).`,
            evidenceJson: JSON.stringify({ bidId: bids[i].id, prevAmount, currAmount }),
          });
        }
      }

      // 3. Pairwise Alternation (Shill Collusion Heuristic)
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
              explanation: `Rule match: 5+ alternating bids between accounts ${userA.substring(0, 8)} and ${userB.substring(0, 8)}.`,
              evidenceJson: JSON.stringify({ accounts: [userA, userB], alternatingCount }),
            });
          }
        }
      }
    }

    // 4. Repeated Non-Payment After Winning
    const unpaidWinners = await this.prisma.transaction.groupBy({
      by: ['buyerId'],
      where: { workflowStatus: { in: ['AWAITING_PAYMENT', 'EXPIRED'] } },
      _count: true,
    });
    for (const row of unpaidWinners) {
      if (row._count >= 2 && auctions[0]) {
        flaggedItems.push({
          auctionId: auctions[0].id,
          userId: row.buyerId,
          flagType: 'REPEATED_NON_PAYMENT_WINNER',
          severity: FlagSeverity.CRITICAL,
          confidenceScore: 0.91,
          explanation: `Rule match: buyer has ${row._count} unpaid winning transactions pending or expired.`,
          evidenceJson: JSON.stringify({ unpaidCount: row._count }),
        });
      }
    }

    for (const item of flaggedItems) {
      await this.prisma.suspiciousActivityFlag.create({ data: item });
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
      take: 60,
    });
  }

  async dismissFlag(flagId: string, adminId?: string, decision = 'DISMISSED') {
    const updated = await this.prisma.suspiciousActivityFlag.update({
      where: { id: flagId },
      data: {
        reviewedByAdmin: true,
        reviewDecision: decision,
        reviewedById: adminId || null,
      },
    });
    await this.auditService.record({
      userId: adminId,
      action: 'RISK_FLAG_REVIEWED',
      entityType: 'SuspiciousActivityFlag',
      entityId: flagId,
      newState: { reviewedByAdmin: true, decision },
    });
    return updated;
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
      take: 100,
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

  async getSettings() {
    return this.prisma.platformSetting.findMany({ orderBy: { key: 'asc' } });
  }

  async updateSetting(key: string, value: string, description: string | undefined, adminId: string) {
    const updated = await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value, description, updatedById: adminId },
      create: { key, value, description, updatedById: adminId },
    });
    await this.auditService.record({
      userId: adminId,
      action: 'PLATFORM_SETTING_UPDATED',
      entityType: 'PlatformSetting',
      entityId: updated.id,
      newState: { key, value },
      reason: `Setting ${key} updated by Super Admin`,
    });
    return updated;
  }
}
