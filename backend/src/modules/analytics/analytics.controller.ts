import { Controller, Get, Post, Put, Param, Body, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Analytics, Risk Engine & Platform Settings')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform overview statistics (simulated transactions labeled separately)' })
  async getOverview() {
    return this.analyticsService.getPlatformOverview();
  }

  @Get('admin/detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AUCTION_MANAGER, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Detailed category, success rate, deposit, and risk analytics' })
  async getDetailed() {
    return this.analyticsService.getDetailedAnalytics();
  }

  @Get('admin/export-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.FINANCE_OFFICER)
  @ApiBearerAuth()
  @Header('Content-Type', 'text/csv')
  @ApiOperation({ summary: 'Export category and simulated platform analytics summary as CSV' })
  async exportCsv() {
    const detailed = await this.analyticsService.getDetailedAnalytics();
    const lines = ['Category,Total Auctions,Completed Auctions,Avg Winning Price (Simulated ETB)'];
    for (const row of detailed.byCategory) {
      lines.push(`"${row.category}",${row.totalAuctions},${row.completedAuctions},${row.avgWinningPriceETB}`);
    }
    return lines.join('\n');
  }

  @Get('admin/fraud-flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.AUCTION_MANAGER, Role.SUPPORT_OFFICER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Retrieve AI-assisted rule-based risk flags' })
  async getFraudFlags() {
    return this.analyticsService.getAdminFlags();
  }

  @Post('admin/run-scan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Trigger rule-based risk detection scan' })
  async runFraudScan() {
    return this.analyticsService.runFraudDetectionScan();
  }

  @Put('admin/flags/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Record manual review decision on a risk flag' })
  async dismissFlag(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body('decision') decision?: string,
  ) {
    return this.analyticsService.dismissFlag(id, adminId, decision || 'DISMISSED');
  }

  @Get('admin/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Get immutable audit log entries' })
  async getAuditLogs() {
    return this.analyticsService.getAuditLogs();
  }

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPORT_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin / Support: Get submitted listing reports' })
  async getReports() {
    return this.analyticsService.getReports();
  }

  @Put('admin/reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPPORT_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin / Support: Update listing report status' })
  async resolveReport(@Param('id') id: string, @Body('status') status: string) {
    return this.analyticsService.resolveReport(id, status || 'RESOLVED');
  }

  @Get('admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Get configurable platform settings' })
  async getSettings() {
    return this.analyticsService.getSettings();
  }

  @Put('admin/settings/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Super Admin: Update platform setting (logged in audit log)' })
  async updateSetting(
    @Param('key') key: string,
    @CurrentUser('id') adminId: string,
    @Body('value') value: string,
    @Body('description') description?: string,
  ) {
    return this.analyticsService.updateSetting(key, value, description, adminId);
  }
}
