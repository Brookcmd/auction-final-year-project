import { Controller, Get, Post, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InspectionsService } from './inspections.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InspectionCategoryType, Role } from '@prisma/client';

@ApiTags('Inspection Partner Network')
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get('templates/:categoryType')
  @ApiOperation({ summary: 'Get standardized inspection checklist template for a category' })
  getTemplate(@Param('categoryType') categoryType: InspectionCategoryType) {
    return this.inspectionsService.getTemplate(categoryType);
  }

  @Post('partners/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to register as an independent inspection partner' })
  async registerPartner(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.inspectionsService.registerPartner(userId, body);
  }

  @Get('partners')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AUCTION_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin / Auction Manager: List inspection partners' })
  async listPartners(@Query('status') status?: string) {
    return this.inspectionsService.listPartners(status);
  }

  @Put('partners/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Approve, reject, or suspend an inspection partner' })
  async reviewPartner(
    @Param('id') partnerId: string,
    @CurrentUser('id') adminId: string,
    @Body('status') status: 'APPROVED' | 'REJECTED' | 'SUSPENDED',
    @Body('reason') reason?: string,
  ) {
    return this.inspectionsService.reviewPartner(partnerId, adminId, status, reason);
  }

  @Post('requests/:auctionId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller or Auction Manager: Request physical inspection for a listing' })
  async createRequest(
    @Param('auctionId') auctionId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { categoryType: InspectionCategoryType; locationAddress: string; notes?: string },
  ) {
    return this.inspectionsService.createInspectionRequest(auctionId, userId, body);
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: List all inspection requests and report statuses' })
  async listRequests() {
    return this.inspectionsService.listAllRequests();
  }

  @Post('requests/:requestId/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: Assign an approved inspector to a request' })
  async assignInspector(
    @Param('requestId') requestId: string,
    @CurrentUser('id') managerId: string,
    @Body('partnerId') partnerId: string,
    @Body('feeETB') feeETB?: number,
  ) {
    return this.inspectionsService.assignInspector(requestId, partnerId, managerId, feeETB);
  }

  @Get('partner/dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTION_PARTNER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inspection Partner: View assigned inspections and submitted reports' })
  async getPartnerDashboard(@CurrentUser('id') userId: string) {
    return this.inspectionsService.getPartnerDashboardData(userId);
  }

  @Put('assignments/:assignmentId/respond')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTION_PARTNER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inspection Partner: Accept/schedule or reject assignment' })
  async respondAssignment(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser('id') userId: string,
    @Body() body: { accept: boolean; scheduledAt?: string; rejectionReason?: string },
  ) {
    return this.inspectionsService.respondToAssignment(
      assignmentId,
      userId,
      body.accept,
      body.scheduledAt,
      body.rejectionReason,
    );
  }

  @Post('requests/:requestId/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.INSPECTION_PARTNER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Inspection Partner: Submit standardized inspection report' })
  async submitReport(
    @Param('requestId') requestId: string,
    @CurrentUser('id') userId: string,
    @Body() body: any,
  ) {
    return this.inspectionsService.submitReport(requestId, userId, body);
  }

  @Put('reports/:reportId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: Approve or reject submitted inspection report' })
  async reviewReport(
    @Param('reportId') reportId: string,
    @CurrentUser('id') managerId: string,
    @Body('decision') decision: 'APPROVED' | 'REJECTED' | 'CHANGES_REQUESTED',
    @Body('reviewNotes') reviewNotes?: string,
  ) {
    return this.inspectionsService.reviewReport(reportId, managerId, decision, reviewNotes);
  }
}
