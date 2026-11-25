import { Controller, Get, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, UserStatus, VerificationStatus } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile with activity stats' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update personal profile details' })
  async updateProfile(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.usersService.updateProfile(userId, body);
  }

  @Post('verification-request')
  @ApiOperation({ summary: 'Submit KYC national ID verification request' })
  async submitVerification(@CurrentUser('id') userId: string, @Body() body: any) {
    return this.usersService.submitVerification(userId, body);
  }

  // Admin endpoints
  @Get('admin/all')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: List all users with pagination and search' })
  async findAllUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
  ) {
    return this.usersService.findAllUsers(Number(page), Number(limit), search);
  }

  @Put('admin/:id/status')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Suspend or activate a user account' })
  async updateUserStatus(@Param('id') userId: string, @Body('status') status: UserStatus) {
    return this.usersService.updateUserStatus(userId, status);
  }

  @Get('admin/verifications')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: List KYC verification requests' })
  async getVerifications() {
    return this.usersService.getPendingVerifications();
  }

  @Put('admin/verification/:id/review')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin: Approve or reject KYC verification request' })
  async reviewVerification(
    @Param('id') requestId: string,
    @Body('status') status: VerificationStatus,
    @Body('reviewerNotes') reviewerNotes?: string,
  ) {
    return this.usersService.reviewVerification(requestId, status, reviewerNotes);
  }
}
