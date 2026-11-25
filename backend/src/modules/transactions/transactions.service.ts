import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentStatus, DeliveryStatus, PaymentProvider } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

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
            images: { take: 1 },
          },
        },
        buyer: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
        seller: { select: { id: true, email: true, profile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransactionDetails(transactionId: string, userId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        auction: {
          include: { images: true, category: true },
        },
        buyer: { select: { id: true, email: true, profile: true } },
        seller: { select: { id: true, email: true, profile: true } },
        payments: true,
        dispute: true,
      },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== userId && tx.sellerId !== userId) {
      throw new ForbiddenException('Not authorized to view this transaction');
    }

    return tx;
  }

  /**
   * Simulated Payment Integration (Telebirr / CBE Birr)
   * Places funds in Escrow until buyer receives goods
   */
  async processSimulatedPayment(
    transactionId: string,
    buyerId: string,
    provider: PaymentProvider,
    paymentRef?: string,
  ) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== buyerId) throw new ForbiddenException('Only the winning buyer can pay');
    if (tx.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Payment already ${tx.paymentStatus}`);
    }

    const ref = paymentRef || `${provider}_SIM_${Date.now()}`;

    // Execute escrow funding
    return this.prisma.$transaction(async (prismaTx) => {
      await prismaTx.payment.create({
        data: {
          transactionId,
          amount: tx.finalAmount,
          provider,
          providerRef: ref,
          status: 'SUCCESS',
          rawResponse: JSON.stringify({
            simulated: true,
            provider,
            timestamp: new Date().toISOString(),
            status: 'TRANSACTION_SUCCESS',
          }),
        },
      });

      return prismaTx.transaction.update({
        where: { id: transactionId },
        data: {
          paymentStatus: PaymentStatus.IN_ESCROW,
          paymentProvider: provider,
          paymentReference: ref,
        },
      });
    });
  }

  /**
   * Confirm Delivery and Release Funds from Escrow to Seller
   */
  async confirmDeliveryAndReleaseEscrow(transactionId: string, buyerId: string) {
    const tx = await this.prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!tx) throw new NotFoundException('Transaction not found');
    if (tx.buyerId !== buyerId) throw new ForbiddenException('Only the buyer can confirm inspection');
    if (tx.paymentStatus !== PaymentStatus.IN_ESCROW) {
      throw new BadRequestException('Transaction is not in escrow');
    }

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus: PaymentStatus.RELEASED_TO_SELLER,
        deliveryStatus: DeliveryStatus.ACCEPTED,
        escrowReleasedAt: new Date(),
      },
    });
  }
}
