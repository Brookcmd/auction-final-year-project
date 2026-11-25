import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import {
  DeliveryStatus,
  NotificationType,
  PaymentProvider,
  PaymentStatus,
  Role,
  TransactionWorkflowStatus,
} from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getUserTransactions(userId: string) {
    return this.prisma.transaction.findMany({
      where: {
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      include: {
        auction: {
          select: {
            id: true,
            title: true,
            itemCode: true,
            locationCity: true,
            images: { take: 1 },
          },
        },
        delivery: {
          include: { partner: true },
        },
        dispute: { select: { id: true, disputeCode: true, status: true } },
        buyer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        seller: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listAllTransactionsAdmin() {
    return this.prisma.transaction.findMany({
      include: {
        auction: { select: { id: true, title: true, itemCode: true } },
        delivery: true,
        buyer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        seller: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getTransactionDetails(transactionId: string, userId: string, userRole?: Role) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        auction: {
          include: { images: true, category: true },
        },
        buyer: { select: { id: true, email: true, profile: true } },
        seller: { select: { id: true, email: true, profile: true } },
        payments: true,
        delivery: { include: { partner: true } },
        dispute: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    const isStaff =
      userRole === Role.SUPER_ADMIN ||
      userRole === Role.ADMIN ||
      userRole === Role.FINANCE_OFFICER ||
      userRole === Role.SUPPORT_OFFICER;

    if (!isStaff && tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to view this transaction');
    }

    return tx;
  }

  async processSimulatedPayment(
    transactionId: string,
    buyerId: string,
    provider: PaymentProvider,
    paymentRef?: string,
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { auction: true },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== buyerId) throw new ForbiddenException('Only the winning buyer can pay');
    if (tx.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment already ${tx.paymentStatus}`);
    }

    const payableAmount = Math.max(0, Number(tx.finalAmount) - Number(tx.appliedDepositETB));
    const ref = paymentRef || `${provider}_SIM_${Date.now()}`;

    const updated = await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.payment.create({
        data: {
          transactionId,
          amount: payableAmount,
          provider,
          providerRef: ref,
          status: 'SIMULATED_SUBMITTED',
          isSimulated: true,
          rawResponse: JSON.stringify({
            simulated: true,
            notice: 'Prototype simulated payment environment — no real funds transferred',
            provider,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      await prismaTx.financialLedgerEntry.create({
        data: {
          transactionId,
          userId: buyerId,
          entryType: 'PAYMENT_SUBMITTED',
          amount: payableAmount,
          currency: 'ETB',
          isSimulated: true,
          reference: ref,
          notes: `Simulated payment submitted via ${provider}`,
        },
      });

      await prismaTx.notification.create({
        data: {
          userId: tx.sellerId,
          title: 'Buyer Submitted Simulated Payment',
          message: `Winning buyer submitted simulated payment (${ref}) for "${tx.auction.title}".`,
          type: NotificationType.PAYMENT_CONFIRMED,
          linkUrl: '/dashboard/seller',
        },
      });

      return prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: PaymentStatus.IN_ESCROW,
          workflowStatus: TransactionWorkflowStatus.PAYMENT_SUBMITTED,
          paymentProvider: provider,
          paymentReference: ref,
        },
      });
    });

    await this.auditService.record({
      userId: buyerId,
      action: 'TRANSACTION_SIMULATED_PAYMENT_SUBMITTED',
      entityType: 'Transaction',
      entityId: transactionId,
      newState: {
        paymentStatus: PaymentStatus.IN_ESCROW,
        workflowStatus: TransactionWorkflowStatus.PAYMENT_SUBMITTED,
        isSimulated: true,
      },
      referenceId: ref,
    });

    return updated;
  }

  async confirmPaymentByFinance(transactionId: string, officerId: string, notes?: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { auction: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');

    const updated = await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.financialLedgerEntry.create({
        data: {
          transactionId,
          userId: tx.buyerId,
          entryType: 'PAYMENT_CONFIRMED',
          amount: tx.finalAmount,
          currency: 'ETB',
          isSimulated: true,
          reference: tx.paymentReference || tx.agreementNumber,
          performedById: officerId,
          notes: notes || 'Simulated payment verified by Finance Officer',
        },
      });

      await prismaTx.notification.create({
        data: {
          userId: tx.buyerId,
          title: 'Payment Verified — Ready for Collection/Delivery',
          message: `Finance confirmed simulated payment for "${tx.auction.title}". You may now schedule pickup or delivery.`,
          type: NotificationType.PAYMENT_CONFIRMED,
          linkUrl: '/dashboard/buyer',
        },
      });

      return prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          workflowStatus: TransactionWorkflowStatus.PAYMENT_CONFIRMED,
        },
      });
    });

    await this.auditService.record({
      userId: officerId,
      action: 'TRANSACTION_PAYMENT_CONFIRMED_BY_FINANCE',
      entityType: 'Transaction',
      entityId: transactionId,
      previousState: { workflowStatus: tx.workflowStatus },
      newState: { workflowStatus: TransactionWorkflowStatus.PAYMENT_CONFIRMED },
      reason: notes || 'Verified by Finance Officer',
    });

    return updated;
  }

  // Delivery & Collection Management
  async listDeliveryPartners() {
    return this.prisma.deliveryPartner.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createDeliveryPartner(dto: { name: string; phone: string; email: string; serviceCities: string }) {
    return this.prisma.deliveryPartner.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        serviceCities: dto.serviceCities,
      },
    });
  }

  async scheduleDelivery(
    transactionId: string,
    userId: string,
    dto: {
      deliveryOption: 'BUYER_COLLECTION' | 'DELIVERY_PARTNER';
      partnerId?: string;
      deliveryAddress?: string;
      scheduledDate?: string;
    },
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { auction: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized for this transaction');
    }

    const isPartnerDelivery = dto.deliveryOption === 'DELIVERY_PARTNER';
    const shippingFeeETB = isPartnerDelivery ? 1500 : 0;
    const nextDeliveryStatus = isPartnerDelivery
      ? DeliveryStatus.SCHEDULED
      : DeliveryStatus.AWAITING_PICKUP;
    const nextWorkflow = isPartnerDelivery
      ? TransactionWorkflowStatus.IN_DELIVERY
      : TransactionWorkflowStatus.AWAITING_COLLECTION;
    const trackingCode = `TRK-${Date.now().toString(36).toUpperCase()}`;

    const delivery = await this.prisma.$transaction(async (prismaTx) => {
      const saved = await prismaTx.delivery.upsert({
        where: { transactionId },
        update: {
          deliveryOption: dto.deliveryOption,
          partnerId: isPartnerDelivery ? dto.partnerId || null : null,
          pickupAddress: tx.auction.locationCity,
          deliveryAddress: dto.deliveryAddress || null,
          shippingFeeETB,
          status: nextDeliveryStatus,
          trackingCode,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
        },
        create: {
          transactionId,
          deliveryOption: dto.deliveryOption,
          partnerId: isPartnerDelivery ? dto.partnerId || null : null,
          pickupAddress: tx.auction.locationCity,
          deliveryAddress: dto.deliveryAddress || null,
          shippingFeeETB,
          status: nextDeliveryStatus,
          trackingCode,
          scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : new Date(),
        },
      });

      await prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          deliveryStatus: nextDeliveryStatus,
          workflowStatus: nextWorkflow,
        },
      });

      await prismaTx.notification.create({
        data: {
          userId: tx.sellerId,
          title: isPartnerDelivery ? 'Delivery Scheduled' : 'Buyer Collection Scheduled',
          message: `Collection/delivery (${trackingCode}) scheduled for "${tx.auction.title}".`,
          type: NotificationType.DELIVERY_UPDATE,
          linkUrl: '/dashboard/seller',
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId,
      action: 'DELIVERY_SCHEDULED',
      entityType: 'Delivery',
      entityId: delivery.id,
      newState: { deliveryOption: dto.deliveryOption, status: nextDeliveryStatus, trackingCode },
    });

    return delivery;
  }

  async updateDeliveryStatus(
    transactionId: string,
    actorId: string,
    dto: { status: DeliveryStatus; proofOfDeliveryUrl?: string },
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { delivery: true, auction: true },
    });
    if (!tx || !tx.delivery) throw new NotFoundException('Delivery record not found');

    const updated = await this.prisma.$transaction(async (prismaTx) => {
      const saved = await prismaTx.delivery.update({
        where: { transactionId },
        data: {
          status: dto.status,
          proofOfDeliveryUrl: dto.proofOfDeliveryUrl || tx.delivery!.proofOfDeliveryUrl,
          confirmedByBuyerAt:
            dto.status === DeliveryStatus.COLLECTION_CONFIRMED || dto.status === DeliveryStatus.DELIVERED
              ? new Date()
              : tx.delivery!.confirmedByBuyerAt,
        },
      });

      let nextWorkflow = tx.workflowStatus;
      if (dto.status === DeliveryStatus.DELIVERED || dto.status === DeliveryStatus.COLLECTION_CONFIRMED) {
        nextWorkflow = TransactionWorkflowStatus.DELIVERED;
      } else if (dto.status === DeliveryStatus.DELIVERY_DISPUTED) {
        nextWorkflow = TransactionWorkflowStatus.DISPUTED;
      }

      await prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          deliveryStatus: dto.status,
          workflowStatus: nextWorkflow,
        },
      });

      return saved;
    });

    await this.auditService.record({
      userId: actorId,
      action: `DELIVERY_STATUS_${dto.status}`,
      entityType: 'Delivery',
      entityId: updated.id,
      newState: { status: dto.status },
    });

    return updated;
  }

  async confirmDeliveryAndReleaseEscrow(transactionId: string, buyerId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { auction: true },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can confirm inspection');
    if (tx.paymentStatus !== PaymentStatus.IN_ESCROW) {
      throw new BadRequestException('Transaction payment has not been submitted');
    }

    const updated = await this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.delivery.updateMany({
        where: { transactionId },
        data: {
          status: DeliveryStatus.COLLECTION_CONFIRMED,
          confirmedByBuyerAt: new Date(),
        },
      });

      await prismaTx.auction.update({
        where: { id: tx.auctionId },
        data: { status: 'COMPLETED' },
      });

      await prismaTx.notification.create({
        data: {
          userId: tx.sellerId,
          title: 'Transaction Completed!',
          message: `Buyer confirmed receipt for "${tx.auction.title}". Transaction ${tx.agreementNumber || tx.id} is closed.`,
          type: NotificationType.PAYMENT_CONFIRMED,
          linkUrl: '/dashboard/seller',
        },
      });

      return prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: PaymentStatus.RELEASED_TO_SELLER,
          workflowStatus: TransactionWorkflowStatus.COMPLETED,
          deliveryStatus: DeliveryStatus.COLLECTION_CONFIRMED,
          escrowReleasedAt: new Date(),
          buyerConfirmedAt: new Date(),
        },
      });
    });

    await this.auditService.record({
      userId: buyerId,
      action: 'TRANSACTION_COMPLETED',
      entityType: 'Transaction',
      entityId: transactionId,
      previousState: { workflowStatus: tx.workflowStatus },
      newState: { workflowStatus: TransactionWorkflowStatus.COMPLETED },
    });

    return updated;
  }

  async rateTransaction(transactionId: string, buyerId: string, rating: number, review?: string) {
    const tx = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can submit a rating');
    if (rating < 1 || rating > 5) throw new BadRequestException('Rating must be between 1 and 5');

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { buyerRating: rating, buyerReview: review || null },
    });
  }

  async getDigitalAgreement(transactionId: string, userId: string, userRole?: Role) {
    const tx = await this.getTransactionDetails(transactionId, userId, userRole);
    const agreementNo = tx.agreementNumber || `AGR-${tx.id.substring(0, 8).toUpperCase()}`;

    return {
      agreementNumber: agreementNo,
      generatedAt: new Date().toISOString(),
      prototypeNotice:
        'SIMULATED PAYMENT ENVIRONMENT: This agreement records an academic prototype transaction on BIDORA. No real funds or legally binding escrow custody are held.',
      auctionTitle: tx.auction.title,
      itemCode: tx.auction.itemCode || 'N/A',
      itemDescription: tx.auction.description,
      buyer: {
        name: tx.buyer.profile?.fullName || tx.buyer.email,
        email: tx.buyer.email,
        city: tx.buyer.profile?.city || 'Ethiopia',
      },
      seller: {
        name: tx.seller.profile?.fullName || tx.seller.email,
        email: tx.seller.email,
        city: tx.seller.profile?.city || 'Ethiopia',
      },
      financials: {
        currency: 'ETB',
        winningAmount: Number(tx.finalAmount),
        appliedDepositETB: Number(tx.appliedDepositETB),
        platformFeeETB: Number(tx.platformFeeETB),
        netPayableETB: Math.max(0, Number(tx.finalAmount) - Number(tx.appliedDepositETB)),
        paymentProvider: tx.paymentProvider,
        paymentStatus: tx.paymentStatus,
        workflowStatus: tx.workflowStatus,
        paymentReference: tx.paymentReference || 'Pending',
        paymentDeadline: tx.paymentDeadline,
      },
      deliveryTerms: {
        option: tx.delivery?.deliveryOption || 'BUYER_COLLECTION',
        pickupLocation: tx.auction.locationCity,
        deliveryStatus: tx.deliveryStatus,
        trackingCode: tx.delivery?.trackingCode || null,
      },
      conditions: [
        'Winning bid is final and recorded immutably in the BIDORA ledger.',
        'Buyer must complete simulated payment before the stated payment deadline.',
        'Item inspection and delivery disputes may be filed through BIDORA Dispute Management.',
      ],
    };
  }
}
