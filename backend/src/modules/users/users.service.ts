import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { NotificationType, Role, UserStatus, VerificationStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        notificationPref: true,
        inspectionPartner: true,
        verificationRequests: {
          orderBy: { submittedAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            auctions: true,
            bids: true,
            wonAuctions: true,
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    delete (user as any).passwordHash;
    delete (user as any).refreshTokenHash;
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phoneNumber?: string;
      city?: string;
      address?: string;
      avatarUrl?: string;
      businessName?: string;
      businessRegNumber?: string;
    },
  ) {
    return this.prisma.userProfile.update({
      where: { userId },
      data,
    });
  }

  async submitVerification(
    userId: string,
    data: {
      applicantType?: string;
      legalName?: string;
      phoneNumber?: string;
      idType: string;
      idNumber?: string;
      address?: string;
      documentFrontUrl: string;
      documentBackUrl?: string;
      businessName?: string;
      businessRegNumber?: string;
      businessDocUrl?: string;
      ownershipDocUrl?: string;
    },
  ) {
    if (!data.documentFrontUrl || !data.documentFrontUrl.startsWith('http')) {
      throw new BadRequestException('A valid identity document URL is required');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const applicantType = data.applicantType || (user.role === Role.SELLER ? 'SELLER' : 'BUYER');

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.verificationRequest.create({
        data: {
          userId,
          applicantType,
          legalName: data.legalName || user.profile?.fullName,
          phoneNumber: data.phoneNumber || user.profile?.phoneNumber,
          idType: data.idType || 'Ethiopian National ID',
          idNumber: data.idNumber || null,
          address: data.address || user.profile?.address,
          documentFrontUrl: data.documentFrontUrl,
          documentBackUrl: data.documentBackUrl || null,
          businessName: data.businessName || user.profile?.businessName,
          businessRegNumber: data.businessRegNumber || user.profile?.businessRegNumber,
          businessDocUrl: data.businessDocUrl || null,
          ownershipDocUrl: data.ownershipDocUrl || null,
          status: VerificationStatus.PENDING_REVIEW,
        },
      });

      await tx.userProfile.update({
        where: { userId },
        data: {
          verificationStatus: VerificationStatus.PENDING_REVIEW,
          nationalIdNumber: data.idNumber || user.profile?.nationalIdNumber,
          businessName: data.businessName || user.profile?.businessName,
          businessRegNumber: data.businessRegNumber || user.profile?.businessRegNumber,
        },
      });

      return created;
    });

    await this.auditService.record({
      userId,
      action: 'VERIFICATION_SUBMITTED',
      entityType: 'VerificationRequest',
      entityId: request.id,
      newState: { status: VerificationStatus.PENDING_REVIEW, applicantType },
    });

    return request;
  }

  async getMyVerifications(userId: string) {
    return this.prisma.verificationRequest.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getNotificationPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateNotificationPreferences(userId: string, data: any) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      update: {
        inAppEnabled: data.inAppEnabled,
        emailEnabled: data.emailEnabled,
        outbidAlerts: data.outbidAlerts,
        auctionAlerts: data.auctionAlerts,
        disputeAlerts: data.disputeAlerts,
        adminAlerts: data.adminAlerts,
      },
      create: { userId, ...data },
    });
  }

  // Verification Officer / Super Admin Methods
  async getPendingVerifications(statusFilter?: VerificationStatus) {
    return this.prisma.verificationRequest.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
            profile: {
              select: {
                fullName: true,
                city: true,
                isKycVerified: true,
                verificationStatus: true,
                businessName: true,
              },
            },
          },
        },
        accessLogs: {
          take: 5,
          orderBy: { accessedAt: 'desc' },
        },
      },
      take: 60,
    });
  }

  /**
   * Securely retrieve verification documents and log officer access
   */
  async inspectVerificationDocuments(requestId: string, officerId: string) {
    const req = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
      include: {
        user: {
          select: { id: true, email: true, role: true, profile: true },
        },
        accessLogs: {
          orderBy: { accessedAt: 'desc' },
          include: {
            accessedBy: { select: { id: true, email: true, role: true } },
          },
        },
      },
    });
    if (!req) throw new NotFoundException('Verification application not found');

    await this.prisma.documentAccessLog.create({
      data: {
        verificationRequestId: requestId,
        accessedById: officerId,
        action: 'VIEWED_IDENTITY_DOCUMENTS',
      },
    });

    return req;
  }

  async reviewVerification(
    requestId: string,
    reviewerId: string,
    status: VerificationStatus,
    reviewerNotes?: string,
  ) {
    const existing = await this.prisma.verificationRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) throw new NotFoundException('Verification request not found');

    if (
      (status === VerificationStatus.REJECTED ||
        status === VerificationStatus.ADDITIONAL_INFO_REQUIRED ||
        status === VerificationStatus.SUSPENDED) &&
      (!reviewerNotes || !reviewerNotes.trim())
    ) {
      throw new BadRequestException('A reason or note is required for rejection, suspension, or info requests');
    }

    const isVerifiedOutcome =
      status === VerificationStatus.VERIFIED || status === VerificationStatus.APPROVED;

    const normalizedStatus = isVerifiedOutcome ? VerificationStatus.VERIFIED : status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const request = await tx.verificationRequest.update({
        where: { id: requestId },
        data: {
          status: normalizedStatus,
          reviewerId,
          reviewerNotes: reviewerNotes || null,
          reviewedAt: new Date(),
        },
        include: { user: true },
      });

      await tx.userProfile.update({
        where: { userId: request.userId },
        data: {
          isKycVerified: isVerifiedOutcome,
          verificationStatus: normalizedStatus,
        },
      });

      await tx.notification.create({
        data: {
          userId: request.userId,
          title: isVerifiedOutcome
            ? 'Identity Verification Approved'
            : `Verification Update: ${normalizedStatus.replace(/_/g, ' ')}`,
          message: isVerifiedOutcome
            ? 'Your identity verification has been approved. Your account now carries Verified status.'
            : `Your verification status changed to ${normalizedStatus}. Note: ${reviewerNotes || 'Check verification details.'}`,
          type: NotificationType.VERIFICATION_UPDATE,
          linkUrl: '/dashboard/profile',
        },
      });

      return request;
    });

    await this.auditService.record({
      userId: reviewerId,
      action: 'VERIFICATION_REVIEWED',
      entityType: 'VerificationRequest',
      entityId: requestId,
      previousState: { status: existing.status },
      newState: { status: normalizedStatus },
      reason: reviewerNotes || 'Reviewed by officer',
      referenceId: updated.userId,
    });

    return updated;
  }

  // Super Admin User Management
  async findAllUsers(page = 1, limit = 30, search?: string, roleFilter?: Role) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (roleFilter) {
      where.role = roleFilter;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { profile: { fullName: { contains: search, mode: 'insensitive' as const } } },
      ];
    }

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const sanitized = users.map((u) => {
      delete (u as any).passwordHash;
      delete (u as any).refreshTokenHash;
      return u;
    });

    return { total, page, limit, totalPages: Math.ceil(total / limit), users: sanitized };
  }

  async updateUserStatus(userId: string, actorId: string, status: UserStatus, reason?: string) {
    if ((status === UserStatus.SUSPENDED || status === UserStatus.BANNED) && (!reason || !reason.trim())) {
      throw new BadRequestException('A documented reason is required when suspending or banning an account');
    }

    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        // Immediately revoke active refresh sessions when suspending or banning
        refreshTokenHash:
          status === UserStatus.SUSPENDED || status === UserStatus.BANNED ? null : existing.refreshTokenHash,
      },
      select: { id: true, email: true, status: true, role: true },
    });

    await this.prisma.notification.create({
      data: {
        userId,
        title: `Account Status Changed: ${status}`,
        message: `Your account status was updated to ${status}.${reason ? ` Reason: ${reason}` : ''}`,
        type: NotificationType.ADMIN_ACTION,
        linkUrl: '/dashboard/profile',
      },
    });

    await this.auditService.record({
      userId: actorId,
      action: `USER_STATUS_${status}`,
      entityType: 'User',
      entityId: userId,
      previousState: { status: existing.status },
      newState: { status },
      reason: reason || `Status updated to ${status}`,
    });

    return updated;
  }

  async createStaffOrAssignRole(
    actorId: string,
    dto: { email: string; password?: string; fullName: string; role: Role; city?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: { role: dto.role },
        select: { id: true, email: true, role: true, status: true },
      });
      await this.auditService.record({
        userId: actorId,
        action: 'STAFF_ROLE_UPDATED',
        entityType: 'User',
        entityId: existing.id,
        previousState: { role: existing.role },
        newState: { role: dto.role },
        reason: `Role assigned by administrator`,
      });
      return updated;
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('A password of at least 6 characters is required for new staff accounts');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const created = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        emailVerified: true,
        status: UserStatus.ACTIVE,
        profile: {
          create: {
            fullName: dto.fullName,
            city: dto.city || 'Addis Ababa',
            isKycVerified: true,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        },
      },
      select: { id: true, email: true, role: true, status: true, profile: true },
    });

    await this.auditService.record({
      userId: actorId,
      action: 'STAFF_ACCOUNT_CREATED',
      entityType: 'User',
      entityId: created.id,
      newState: { role: dto.role, email: created.email },
      reason: `Provisioned specialized staff role ${dto.role}`,
    });

    return created;
  }
}
