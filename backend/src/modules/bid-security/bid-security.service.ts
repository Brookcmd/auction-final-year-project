import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { DepositStatus, NotificationType, PaymentProvider } from '@prisma/client';

@Injectable()
export class BidSecurityService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async listPolicies() {
    return this.prisma.bidSecurityPolicy.findMany({
      include: { category: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPolicy(actorId: string, dto: any) {
    const policy = await this.prisma.bidSecurityPolicy.create({
      data: {
        name: dto.name,
        categoryId: dto.categoryId || null,
        requiresDeposit: dto.requiresDeposit !== false,
        depositType: dto.depositType || 'FIXED',
        fixedAmountETB: dto.fixedAmountETB ?? 5000,
        percentageRate: dto.percentageRate ?? 5.0,
        minDepositETB: dto.minDepositETB ?? 1000,
        maxDepositETB: dto.maxDepositETB ?? 250000,
        eligibleProviders: dto.eligibleProviders || 'TELEBIRR,CBE_BIRR,BANK_TRANSFER',
        paymentDeadlineHours: dto.paymentDeadlineHours ?? 72,
        refundPolicy:
          dto.refundPolicy ||
          'Non-winning bidders become eligible for full simulated deposit refund after auction completion.',
        forfeiturePolicy:
          dto.forfeiturePolicy ||
          'Deposit may face forfeiture review by a Finance Officer only if a confirmed winner fails to pay within the disclosed deadline.',
      },
    });

    await this.auditService.record({
      userId: actorId,
      action: 'BID_SECURITY_POLICY_CREATED',
      entityType: 'BidSecurityPolicy',
      entityId: policy.id,
      newState: policy,
    });

    return policy;
  }

  async calculateRequiredDeposit(auctionId: string) {
    const auction = await this.prisma.auction.findUnique({
      where: { id: auctionId },
      include: { bidSecurityPolicy: true, category: true },
    });
    if (!auction) throw new NotFoundException('Auction not found');

    if (!auction.requiresBidSecurity) {
      return { required: false, amountETB: 0, policy: null };
    }

    let policy = auction.bidSecurityPolicy;
    if (!policy) {
      policy = await this.prisma.bidSecurityPolicy.findFirst({
        where: { categoryId: auction.categoryId, isActive: true },
      });
    }

    if (!policy) {
      return {
        required: true,
        amountETB: 5000,
        paymentDeadlineHours: 72,
        eligibleProviders: ['TELEBIRR', 'CBE_BIRR'],
        refundPolicy: 'Refundable to non-winning bidders after auction closes.',
        forfeiturePolicy: 'Subject to Finance Officer review if winner defaults on payment deadline.',
      };
    }

    let amount = Number(policy.fixedAmountETB);
    if (policy.depositType === 'PERCENTAGE') {
      const computed = (Number(auction.startingPrice) * policy.percentageRate) / 100;
      amount = Math.min(
        Number(policy.maxDepositETB),
        Math.max(Number(policy.minDepositETB), computed),
      );
    }

    return {
      required: true,
      policyId: policy.id,
      policyName: policy.name,
      amountETB: Math.round(amount),
      paymentDeadlineHours: policy.paymentDeadlineHours,
      eligibleProviders: policy.eligibleProviders.split(','),
      refundPolicy: policy.refundPolicy,
      forfeiturePolicy: policy.forfeiturePolicy,
    };
  }

  async submitSimulatedDeposit(
    buyerId: string,
    auctionId: string,
    provider: PaymentProvider,
    termsAccepted: boolean,
  ) {
    if (!termsAccepted) {
      throw new BadRequestException('You must accept the bid security terms and conditions');
    }

    const reqInfo = await this.calculateRequiredDeposit(auctionId);
    if (!reqInfo.required) {
      throw new BadRequestException('This auction does not require a bid security deposit');
    }

    const existing = await this.prisma.bidSecurityDeposit.findUnique({
      where: { buyerId_auctionId: { buyerId, auctionId } },
    });
    if (existing && (existing.status === DepositStatus.CONFIRMED || existing.status === DepositStatus.RESERVED)) {
      return existing;
    }

    const reference = `DEP_SIM_${provider}_${Date.now()}`;
    const actionLog = [
      {
        action: 'SIMULATED_DEPOSIT_CONFIRMED',
        timestamp: new Date().toISOString(),
        provider,
        reference,
        note: 'Simulated prototype deposit confirmed',
      },
    ];

    const deposit = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.bidSecurityDeposit.upsert({
        where: { buyerId_auctionId: { buyerId, auctionId } },
        update: {
          amount: reqInfo.amountETB,
          paymentProvider: provider,
          paymentReference: reference,
          termsAccepted: true,
          status: DepositStatus.CONFIRMED,
          depositDate: new Date(),
          actionHistory: JSON.stringify(actionLog),
        },
        create: {
          buyerId,
          auctionId,
          policyId: reqInfo.policyId || null,
          amount: reqInfo.amountETB,
          currency: 'ETB',
          paymentProvider: provider,
          paymentReference: reference,
          termsAccepted: true,
          status: DepositStatus.CONFIRMED,
          actionHistory: JSON.stringify(actionLog),
        },
      });

      await tx.financialLedgerEntry.create({
        data: {
          depositId: saved.id,
          userId: buyerId,
          entryType: 'DEPOSIT_CONFIRMED',
          amount: reqInfo.amountETB,
          currency: 'ETB',
          isSimulated: true,
          reference,
          notes: `Simulated bid security deposit for auction ${auctionId}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: buyerId,
          title: 'Bid Security Deposit Confirmed (Simulated)',
          message: `Your simulated bid bond of ETB ${reqInfo.amountETB.toLocaleString()} (${reference}) is confirmed. You are now eligible to bid.`,
          type: NotificationType.DEPOSIT_UPDATE,
          linkUrl: `/auctions/${auctionId}`,
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: buyerId,
      action: 'BID_SECURITY_DEPOSIT_CONFIRMED',
      entityType: 'BidSecurityDeposit',
      entityId: deposit.id,
      newState: { status: DepositStatus.CONFIRMED, amount: reqInfo.amountETB, isSimulated: true },
      referenceId: reference,
    });

    return deposit;
  }

  async getMyDeposits(buyerId: string) {
    return this.prisma.bidSecurityDeposit.findMany({
      where: { buyerId },
      include: {
        auction: { select: { id: true, title: true, status: true, itemCode: true } },
      },
      orderBy: { depositDate: 'desc' },
    });
  }

  // Finance Officer / Super Admin endpoints
  async listAllDeposits(status?: DepositStatus) {
    return this.prisma.bidSecurityDeposit.findMany({
      where: status ? { status } : undefined,
      include: {
        buyer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        auction: { select: { id: true, title: true, status: true, winningBidderId: true } },
      },
      orderBy: { depositDate: 'desc' },
      take: 100,
    });
  }

  async listLedger() {
    return this.prisma.financialLedgerEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async processRefund(depositId: string, officerId: string, reason?: string) {
    const dep = await this.prisma.bidSecurityDeposit.findUnique({ where: { id: depositId } });
    if (!dep) throw new NotFoundException('Deposit record not found');

    const refundable: DepositStatus[] = [
      DepositStatus.CONFIRMED,
      DepositStatus.RESERVED,
      DepositStatus.REFUND_PENDING,
      DepositStatus.FORFEITURE_UNDER_REVIEW,
    ];
    if (!refundable.includes(dep.status)) {
      throw new BadRequestException(`Cannot refund deposit in status ${dep.status}`);
    }

    const ref = `REF_SIM_${Date.now()}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.bidSecurityDeposit.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.REFUNDED,
          refundDate: new Date(),
          reviewedById: officerId,
        },
      });

      await tx.financialLedgerEntry.create({
        data: {
          depositId,
          userId: dep.buyerId,
          entryType: 'REFUND_COMPLETED',
          amount: dep.amount,
          currency: 'ETB',
          isSimulated: true,
          reference: ref,
          performedById: officerId,
          notes: reason || 'Authorized simulated deposit refund',
        },
      });

      await tx.notification.create({
        data: {
          userId: dep.buyerId,
          title: 'Bid Security Refund Processed (Simulated)',
          message: `Your simulated bid security deposit of ETB ${Number(dep.amount).toLocaleString()} has been marked Refunded (${ref}).`,
          type: NotificationType.DEPOSIT_UPDATE,
          linkUrl: '/dashboard/buyer',
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: officerId,
      action: 'DEPOSIT_REFUNDED',
      entityType: 'BidSecurityDeposit',
      entityId: depositId,
      previousState: { status: dep.status },
      newState: { status: DepositStatus.REFUNDED },
      reason: reason || 'Finance Officer authorized refund',
      referenceId: ref,
    });

    return updated;
  }

  async decideForfeiture(
    depositId: string,
    officerId: string,
    decision: 'FORFEITED' | 'REFUNDED',
    reason: string,
  ) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('A documented policy reason is required for forfeiture review decisions');
    }

    if (decision === 'REFUNDED') {
      return this.processRefund(depositId, officerId, reason);
    }

    const dep = await this.prisma.bidSecurityDeposit.findUnique({ where: { id: depositId } });
    if (!dep) throw new NotFoundException('Deposit record not found');

    const ref = `FORF_SIM_${Date.now()}`;
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.bidSecurityDeposit.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.FORFEITED,
          forfeitureReason: reason,
          reviewedById: officerId,
        },
      });

      await tx.financialLedgerEntry.create({
        data: {
          depositId,
          userId: dep.buyerId,
          entryType: 'FORFEITURE_APPLIED',
          amount: dep.amount,
          currency: 'ETB',
          isSimulated: true,
          reference: ref,
          performedById: officerId,
          notes: reason,
        },
      });

      await tx.notification.create({
        data: {
          userId: dep.buyerId,
          title: 'Bid Security Forfeiture Decision',
          message: `Finance review decided forfeiture on deposit ${dep.paymentReference || dep.id}. Reason: ${reason}`,
          type: NotificationType.DEPOSIT_UPDATE,
          linkUrl: '/dashboard/buyer',
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: officerId,
      action: 'DEPOSIT_FORFEITED',
      entityType: 'BidSecurityDeposit',
      entityId: depositId,
      previousState: { status: dep.status },
      newState: { status: DepositStatus.FORFEITED },
      reason,
      referenceId: ref,
    });

    return updated;
  }
}
