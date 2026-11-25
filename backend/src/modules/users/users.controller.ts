import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, UserStatus, VerificationStatus } from '@prisma/client';

@ApiTags('Users & Verification')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile with verification and activity stats' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update personal or business profile details' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.usersService.updateProfile(userId, body);
  }

  @Post('verification-request')
  @ApiOperation({ summary: 'Submit buyer or seller KYC verification application' })
  async submitVerification(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.usersService.submitVerification(userId, body);
  }

  @Get('my-verifications')
  @ApiOperation({ summary: 'Get verification history for current user' })
  async getMyVerifications(@CurrentUser('id') userId: string) {
    return this.usersService.getMyVerifications(userId);
  }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Get notification preferences' })
  async getNotificationPreferences(@CurrentUser('id') userId: string) {
    return this.usersService.getNotificationPreferences(userId);
  }

  @Put('notification-preferences')
  @ApiOperation({ summary: 'Update notification preferences' })
  async updateNotificationPreferences(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.usersService.updateNotificationPreferences(userId, body);
  }

  // Admin & Verification Officer endpoints
  @Get('admin/all')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN, Role.SUPPORT_OFFICER, Role.FINANCE_OFFICER)
  @ApiOperation({ summary: 'Admin: List all users with pagination, search, and role filtering' })
  async findAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @Query('search') search?: string,
    @Query('role') role?: Role,
  ) {
    return this.usersService.findAllUsers(Number(page), Number(limit), search, role);
  }

  @Post('admin/staff')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Super Admin: Create specialized staff account or assign role' })
  async createStaff(
    @CurrentUser('id') actorId: string,
    @Body() body: { email: string; password?: string; fullName: string; role: Role; city?: string },
  ) {
    return this.usersService.createStaffOrAssignRole(actorId, body);
  }

  @Put('admin/:id/status')
  @Roles(Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Super Admin: Suspend, ban, or reactivate a user account (requires reason)' })
  async updateUserStatus(
    @Param('id') userId: string,
    @CurrentUser('id') actorId: string,
    @Body('status') status: UserStatus,
    @Body('reason') reason?: string,
  ) {
    return this.usersService.updateUserStatus(userId, actorId, status, reason);
  }

  @Get('admin/verifications')
  @Roles(Role.VERIFICATION_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Verification Officer: List KYC verification applications' })
  async getVerifications(@Query('status') status?: VerificationStatus) {
    return this.usersService.getPendingVerifications(status);
  }

  @Get('admin/verification/:id/documents')
  @Roles(Role.VERIFICATION_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Verification Officer: Inspect documents and log access trail' })
  async inspectDocuments(
    @Param('id') requestId: string,
    @CurrentUser('id') officerId: string,
  ) {
    return this.usersService.inspectVerificationDocuments(requestId, officerId);
  }

  @Put('admin/verification/:id/review')
  @Roles(Role.VERIFICATION_OFFICER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiOperation({ summary: 'Verification Officer: Approve, reject, or request info on KYC application' })
  async reviewVerification(
    @Param('id') requestId: string,
    @CurrentUser('id') reviewerId: string,
    @Body('status') status: VerificationStatus,
    @Body('reviewerNotes') reviewerNotes?: string,
  ) {
    return this.usersService.reviewVerification(requestId, reviewerId, status, reviewerNotes);
  }
}
