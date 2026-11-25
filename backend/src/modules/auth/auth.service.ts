import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/services/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ChangePasswordDto,
} from './dto/account-security.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('An account with this email address already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    // Public registration may only create BUYER, SELLER, or INSPECTION_PARTNER accounts
    const allowedPublicRoles: Role[] = [Role.BUYER, Role.SELLER, Role.INSPECTION_PARTNER];
    const requestedRole = dto.role && allowedPublicRoles.includes(dto.role) ? dto.role : Role.BUYER;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: requestedRole,
        profile: {
          create: {
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber || null,
            city: dto.city || 'Addis Ababa',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        fullName: user.profile?.fullName,
        city: user.profile?.city,
        isKycVerified: user.profile?.isKycVerified,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED' || user.status === 'BANNED') {
      throw new UnauthorizedException(`Account has been ${user.status.toLowerCase()} by administration`);
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        role: user.role,
        fullName: user.profile?.fullName,
        city: user.profile?.city,
        isKycVerified: user.profile?.isKycVerified,
        avatarUrl: user.profile?.avatarUrl,
      },
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>(
        'JWT_REFRESH_SECRET',
        'bidora_jwt_refresh_secret_rotation_key_2026',
      );
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.refreshTokenHash) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      const isTokenMatch = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
      if (!isTokenMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.updateRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch (err) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null },
    });
    return { success: true, message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string) {
    const email = dto.email.toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.status !== 'BANNED' && user.status !== 'SUSPENDED') {
      const resetSecret = this.getPurposeSecret('password_reset');
      await this.jwtService.signAsync(
        {
          sub: user.id,
          email: user.email,
          purpose: 'password_reset',
          pwdSig: user.passwordHash.slice(-12),
        },
        { secret: resetSecret, expiresIn: '15m' },
      );

      await this.auditService.record({
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
      });

      this.logger.log(`Password reset requested for user ${user.id}`);
    }

    return {
      success: true,
      message:
        'If an account matches that email address, password reset instructions have been issued.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string) {
    const resetSecret = this.getPurposeSecret('password_reset');
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.token, { secret: resetSecret });
    } catch {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (payload?.purpose !== 'password_reset' || !payload?.sub) {
      throw new BadRequestException('Invalid password reset token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.passwordHash.slice(-12) !== payload.pwdSig) {
      throw new BadRequestException('Reset token has already been used or is no longer valid');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, refreshTokenHash: null },
    });

    await this.auditService.record({
      userId: user.id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      success: true,
      message: 'Password updated successfully. You may now sign in with your new password.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto, authenticatedUserId?: string, ipAddress?: string) {
    let targetUserId = authenticatedUserId;

    if (dto?.token) {
      const verifySecret = this.getPurposeSecret('email_verification');
      try {
        const payload = this.jwtService.verify(dto.token, { secret: verifySecret });
        if (payload?.purpose !== 'email_verification' || !payload?.sub) {
          throw new BadRequestException('Invalid email verification token');
        }
        targetUserId = payload.sub;
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException('Invalid or expired email verification token');
      }
    }

    if (!targetUserId) {
      throw new UnauthorizedException('Verification token or authenticated session is required');
    }

    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new BadRequestException('Account not found');
    }

    if (!user.emailVerified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });

      await this.auditService.record({
        userId: user.id,
        action: 'EMAIL_VERIFIED',
        entityType: 'User',
        entityId: user.id,
        metadata: { mode: dto?.token ? 'token' : 'authenticated_session' },
        ipAddress,
      });
    }

    return {
      success: true,
      emailVerified: true,
      message: 'Email address verified successfully.',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, ipAddress?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestException('New password must be different from your current password');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.newPassword, salt);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, refreshTokenHash: null },
    });

    await this.auditService.record({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      success: true,
      message: 'Password updated successfully.',
    };
  }

  private getPurposeSecret(purpose: string): string {
    const base = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'bidora_jwt_access_secret_super_secure_key_2026',
    );
    return `${base}:${purpose}`;
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessSecret = this.configService.get<string>(
      'JWT_ACCESS_SECRET',
      'bidora_jwt_access_secret_super_secure_key_2026',
    );
    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'bidora_jwt_refresh_secret_rotation_key_2026',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: '30m',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 1800, // 30 minutes in seconds
    };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const salt = await bcrypt.genSalt(10);
    const refreshTokenHash = await bcrypt.hash(refreshToken, salt);

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }
}
