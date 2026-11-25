import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentProvider } from '@prisma/client';

@ApiTags('Transactions & Escrow')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user transaction history (buyer or seller)' })
  async getUserTransactions(@CurrentUser('id') userId: string) {
    return this.transactionsService.getUserTransactions(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed transaction view with payment status' })
  async getTransactionDetails(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.getTransactionDetails(id, userId);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Simulate Telebirr / CBE Birr escrow payment for won auction' })
  async processPayment(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('provider') provider: PaymentProvider,
    @Body('paymentReference') paymentRef?: string,
  ) {
    return this.transactionsService.processSimulatedPayment(
      id,
      userId,
      provider || PaymentProvider.TELEBIRR,
      paymentRef,
    );
  }

  @Put(':id/confirm-delivery')
  @ApiOperation({ summary: 'Buyer confirms item reception; releases funds from escrow to seller' })
  async confirmDelivery(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.confirmDeliveryAndReleaseEscrow(id, userId);
  }
}
