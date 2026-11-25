import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Analytics & AI Fraud Detection')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('overview')
  @ApiOperation({ summary: 'Public platform activity statistics' })
  async getOverview() {
    return this.analyticsService.getPlatformOverview();
  }

  @Get('admin/fraud-flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Retrieve AI-flagged suspicious bidding activities' })
  async getFraudFlags() {
    return this.analyticsService.getAdminFlags();
  }

  @Post('admin/run-scan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Trigger AI suspicious bidding pattern analysis scan' })
  async runFraudScan() {
    return this.analyticsService.runFraudDetectionScan();
  }

  @Put('admin/flags/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Mark fraud flag as reviewed/dismissed' })
  async dismissFlag(@Param('id') id: string) {
    return this.analyticsService.dismissFlag(id);
  }

  @Get('admin/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get recent immutable audit log entries' })
  async getAuditLogs() {
    return this.analyticsService.getAuditLogs();
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Get submitted listing reports' })
  async getReports() {
    return this.analyticsService.getReports();
  }

  @Put('admin/reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Update listing report status' })
  async resolveReport(@Param('id') id: string, @Body('status') status: string) {
    return this.analyticsService.resolveReport(id, status || 'RESOLVED');
  }
}
