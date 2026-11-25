import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BidSecurityService } from './bid-security.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DepositStatus, PaymentProvider, Role } from '@prisma/client';

@ApiTags('Bid Security & Financial Ledger')
@Controller('bid-security')
export class BidSecurityController {
  constructor(private readonly bidSecurityService: BidSecurityService) {}

  @Get('policies')
  @ApiOperation({ summary: 'List configured bid security policies' })
  async listPolicies() {
    return this.bidSecurityService.listPolicies();
  }

  @Post('policies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin / Finance Officer: Create bid security policy' })
  async createPolicy(@CurrentUser('id') actorId: string, @Body() body: any) {
    return this.bidSecurityService.createPolicy(actorId, body);
  }

  @Get('auction/:auctionId/requirement')
  @ApiOperation({ summary: 'Check bid security requirement and deposit amount for an auction' })
  async getRequirement(@Param('auctionId') auctionId: string) {
    return this.bidSecurityService.calculateRequiredDeposit(auctionId);
  }

  @Post('auction/:auctionId/deposit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: Submit simulated bid security deposit to unlock bidding' })
  async submitDeposit(
    @Param('auctionId') auctionId: string,
    @CurrentUser('id') buyerId: string,
    @Body('provider') provider: PaymentProvider,
    @Body('termsAccepted') termsAccepted: boolean,
  ) {
    return this.bidSecurityService.submitSimulatedDeposit(
      buyerId,
      auctionId,
      provider || PaymentProvider.TELEBIRR,
      termsAccepted !== false,
    );
  }

  @Get('my-deposits')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: Get my bid security deposits' })
  async getMyDeposits(@CurrentUser('id') buyerId: string) {
    return this.bidSecurityService.getMyDeposits(buyerId);
  }

  @Get('admin/deposits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finance Officer: List all bid security deposits' })
  async listAllDeposits(@Query('status') status?: DepositStatus) {
    return this.bidSecurityService.listAllDeposits(status);
  }

  @Get('admin/ledger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finance Officer: View simulated financial ledger entries' })
  async listLedger() {
    return this.bidSecurityService.listLedger();
  }

  @Put('admin/deposits/:id/refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finance Officer: Process authorized simulated deposit refund' })
  async processRefund(
    @Param('id') depositId: string,
    @CurrentUser('id') officerId: string,
    @Body('reason') reason?: string,
  ) {
    return this.bidSecurityService.processRefund(depositId, officerId, reason);
  }

  @Put('admin/deposits/:id/forfeiture-decision')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FINANCE_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finance Officer: Decide forfeiture review (requires policy reason)' })
  async decideForfeiture(
    @Param('id') depositId: string,
    @CurrentUser('id') officerId: string,
    @Body('decision') decision: 'FORFEITED' | 'REFUNDED',
    @Body('reason') reason: string,
  ) {
    return this.bidSecurityService.decideForfeiture(depositId, officerId, decision, reason);
  }
}
