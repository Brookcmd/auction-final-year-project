import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DisputeCategory, DisputeStatus, Role } from '@prisma/client';

@ApiTags('Disputes & Appeals')
@Controller('disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

  @Post()
  @ApiOperation({ summary: 'Buyer or Seller: Open a new dispute case' })
  async openDispute(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      transactionId?: string;
      auctionId?: string;
      category: DisputeCategory;
      reason: string;
      description?: string;
      evidenceUrl?: string;
    },
  ) {
    return this.disputesService.openDispute(userId, body);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get disputes involving the authenticated user' })
  async getMyDisputes(@CurrentUser('id') userId: string) {
    return this.disputesService.getMyDisputes(userId);
  }

  @Get('admin/all')
  @Roles(Role.SUPPORT_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Support Officer / Admin: List all platform disputes' })
  async listAllAdmin(@Query('status') status?: DisputeStatus) {
    return this.disputesService.listAllDisputesAdmin(status);
  }

  @Put(':id/assign')
  @Roles(Role.SUPPORT_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Support Officer: Assign dispute for review' })
  async assignDispute(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body('adminId') adminId?: string,
  ) {
    return this.disputesService.assignDispute(id, adminId || actorId, actorId);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add a timeline message to a dispute' })
  async addMessage(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('message') message: string,
  ) {
    return this.disputesService.addMessage(id, userId, message);
  }

  @Post(':id/evidence')
  @ApiOperation({ summary: 'Upload supporting evidence URL to a dispute' })
  async addEvidence(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('fileUrl') fileUrl: string,
    @Body('description') description?: string,
  ) {
    return this.disputesService.addEvidence(id, userId, fileUrl, description);
  }

  @Put(':id/decision')
  @Roles(Role.SUPPORT_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Support Officer / Admin: Record formal dispute decision' })
  async recordDecision(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() body: { status: DisputeStatus; decision: string; adminNotes?: string },
  ) {
    return this.disputesService.recordDecision(id, adminId, body);
  }

  @Post(':id/appeal')
  @ApiOperation({ summary: 'Submit an appeal against a dispute decision' })
  async submitAppeal(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body('appealReason') appealReason: string,
  ) {
    return this.disputesService.submitAppeal(id, userId, appealReason);
  }
}
