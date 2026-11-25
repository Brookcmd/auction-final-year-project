import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DeliveryStatus, PaymentProvider, Role } from '@prisma/client';

@ApiTags('Transactions, Agreements & Delivery')
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user transaction history (buyer or seller)' })
  async getUserTransactions(@CurrentUser('id') userId: string) {
    return this.transactionsService.getUserTransactions(userId);
  }

  @Get('admin/all')
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Finance Officer / Admin: List all platform transactions' })
  async listAllAdmin() {
    return this.transactionsService.listAllTransactionsAdmin();
  }

  @Get('delivery-partners')
  @ApiOperation({ summary: 'List registered delivery partners' })
  async listDeliveryPartners() {
    return this.transactionsService.listDeliveryPartners();
  }

  @Post('delivery-partners')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AUCTION_MANAGER)
  @ApiOperation({ summary: 'Admin: Register a delivery partner' })
  async createDeliveryPartner(@Body() body: any) {
    return this.transactionsService.createDeliveryPartner(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed transaction view with delivery and payment status' })
  async getTransactionDetails(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transactionsService.getTransactionDetails(id, user.id, user.role);
  }

  @Get(':id/agreement')
  @ApiOperation({ summary: 'Generate structured Digital Transaction Agreement' })
  async getDigitalAgreement(@Param('id') id: string, @CurrentUser() user: any) {
    return this.transactionsService.getDigitalAgreement(id, user.id, user.role);
  }

  @Post(':id/pay')
  @ApiOperation({ summary: 'Simulate Telebirr / CBE Birr payment for won auction' })
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

  @Put(':id/confirm-payment')
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Finance Officer: Confirm submitted simulated payment' })
  async confirmPayment(
    @Param('id') id: string,
    @CurrentUser('id') officerId: string,
    @Body('notes') notes?: string,
  ) {
    return this.transactionsService.confirmPaymentByFinance(id, officerId, notes);
  }

  @Post(':id/delivery')
  @ApiOperation({ summary: 'Schedule item collection or delivery partner shipping' })
  async scheduleDelivery(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.transactionsService.scheduleDelivery(id, userId, body);
  }

  @Put(':id/delivery/status')
  @ApiOperation({ summary: 'Update delivery tracking status and proof of delivery' })
  async updateDeliveryStatus(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() body: { status: DeliveryStatus; proofOfDeliveryUrl?: string },
  ) {
    return this.transactionsService.updateDeliveryStatus(id, actorId, body);
  }

  @Put(':id/confirm-delivery')
  @ApiOperation({ summary: 'Buyer confirms item reception and closes transaction' })
  async confirmDelivery(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.transactionsService.confirmDeliveryAndReleaseEscrow(id, userId);
  }

  @Post(':id/rate')
  @ApiOperation({ summary: 'Buyer rates completed transaction (1 to 5 stars)' })
  async rateTransaction(
    @Param('id') id: string,
    @CurrentUser('id') buyerId: string,
    @Body('rating') rating: number,
    @Body('review') review?: string,
  ) {
    return this.transactionsService.rateTransaction(id, buyerId, Number(rating), review);
  }
}
