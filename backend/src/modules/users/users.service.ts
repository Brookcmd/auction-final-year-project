import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStatus, VerificationStatus } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
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

  async updateProfile(userId: string, data: { fullName?: string; phoneNumber?: string; city?: string; address?: string; avatarUrl?: string }) {
    return this.prisma.userProfile.update({
      where: { userId },
      data,
    });
  }

  async submitVerification(userId: string, data: { idType: string; documentFrontUrl: string; documentBackUrl?: string }) {
    return this.prisma.verificationRequest.create({
      data: {
        userId,
        idType: data.idType,
        documentFrontUrl: data.documentFrontUrl,
        documentBackUrl: data.documentBackUrl || null,
        status: VerificationStatus.PENDING,
      },
    });
  }

  // Admin Methods
  async findAllUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { profile: { fullName: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};

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

  async updateUserStatus(userId: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true, role: true },
    });
  }

  async getPendingVerifications() {
    return this.prisma.verificationRequest.findMany({
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            profile: { select: { fullName: true, city: true, isKycVerified: true } },
          },
        },
      },
      take: 50,
    });
  }

  async reviewVerification(requestId: string, status: VerificationStatus, reviewerNotes?: string) {
    const request = await this.prisma.verificationRequest.update({
      where: { id: requestId },
      data: {
        status,
        reviewerNotes,
        reviewedAt: new Date(),
      },
      include: { user: true },
    });

    if (status === VerificationStatus.APPROVED) {
      await this.prisma.userProfile.update({
        where: { userId: request.userId },
        data: { isKycVerified: true },
      });
    }

    return request;
  }
}
