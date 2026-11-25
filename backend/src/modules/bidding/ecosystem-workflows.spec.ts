import { ExecutionContext, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BiddingService } from './bidding.service';
import { AuctionStatus, DepositStatus, Role, UserStatus } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { BidSecurityService } from '../bid-security/bid-security.service';

describe('BIDORA Ecosystem Security, Eligibility & Concurrency Workflows', () => {
  describe('1. RBAC RolesGuard Permission Enforcement', () => {
    const createMockContext = (userRole: Role, requiredRoles: Role[]): ExecutionContext => {
      return {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'u-1', role: userRole } }),
        }),
      } as unknown as ExecutionContext;
    };

    it('should block a BUYER from FINANCE_OFFICER and AUCTION_MANAGER routes', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([Role.FINANCE_OFFICER]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(() => guard.canActivate(createMockContext(Role.BUYER, [Role.FINANCE_OFFICER]))).toThrow(
        ForbiddenException,
      );
    });

    it('should block an AUCTION_MANAGER from FINANCE_OFFICER routes', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([Role.FINANCE_OFFICER]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(() =>
        guard.canActivate(createMockContext(Role.AUCTION_MANAGER, [Role.FINANCE_OFFICER])),
      ).toThrow(ForbiddenException);
    });

    it('should allow SUPER_ADMIN across all governance officer routes', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([Role.VERIFICATION_OFFICER]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      expect(guard.canActivate(createMockContext(Role.SUPER_ADMIN, [Role.VERIFICATION_OFFICER]))).toBe(true);
    });
  });

  describe('2. Bid Security & Restricted Participation Eligibility Enforcement', () => {
    it('should reject bidding when auction requires bid security and buyer has no confirmed deposit', async () => {
      const mockPrisma: any = {
        auction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'a-sec-1',
            sellerId: 'seller-1',
            status: AuctionStatus.ACTIVE,
            currentHighestBid: 100000,
            bidIncrement: 5000,
            endTime: new Date(Date.now() + 600000),
            requiresBidSecurity: true,
            isRestricted: false,
            seller: { id: 'seller-1' },
          }),
        },
        bidSecurityDeposit: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      const mockRedis: any = {
        acquireLock: jest.fn().mockResolvedValue({ acquired: true, token: 'tok-1' }),
        releaseLock: jest.fn().mockResolvedValue(true),
      };
      const service = new BiddingService(mockPrisma, mockRedis, {} as any);

      await expect(
        service.placeBid('buyer-no-deposit', { auctionId: 'a-sec-1', amount: 105000 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject bidding on a restricted auction if buyer participation is not APPROVED', async () => {
      const mockPrisma: any = {
        auction: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'a-rest-1',
            sellerId: 'seller-1',
            status: AuctionStatus.ACTIVE,
            currentHighestBid: 100000,
            bidIncrement: 5000,
            endTime: new Date(Date.now() + 600000),
            requiresBidSecurity: false,
            isRestricted: true,
            seller: { id: 'seller-1' },
          }),
        },
        auctionParticipation: {
          findUnique: jest.fn().mockResolvedValue({ status: 'PENDING' }),
        },
      };
      const mockRedis: any = {
        acquireLock: jest.fn().mockResolvedValue({ acquired: true, token: 'tok-2' }),
        releaseLock: jest.fn().mockResolvedValue(true),
      };
      const service = new BiddingService(mockPrisma, mockRedis, {} as any);

      await expect(
        service.placeBid('buyer-pending', { auctionId: 'a-rest-1', amount: 105000 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Simultaneous Bid Concurrency Serialization', () => {
    it('should reject simultaneous overlapping bid when distributed lock is already held', async () => {
      let locked = false;
      const mockRedis: any = {
        acquireLock: jest.fn().mockImplementation(async () => {
          if (locked) return { acquired: false, token: '' };
          locked = true;
          return { acquired: true, token: 'lock-tok' };
        }),
        releaseLock: jest.fn().mockImplementation(async () => {
          locked = false;
          return true;
        }),
        setAuctionState: jest.fn().mockResolvedValue(undefined),
      };

      const mockPrisma: any = {
        auction: {
          findUnique: jest.fn().mockImplementation(async () => {
            await new Promise((r) => setTimeout(r, 30));
            return {
              id: 'a-conc-1',
              sellerId: 'seller-1',
              title: 'Concurrent Lot',
              status: AuctionStatus.ACTIVE,
              currentHighestBid: 50000,
              bidIncrement: 1000,
              totalBidsCount: 1,
              endTime: new Date(Date.now() + 600000),
              antiSnipingExtensions: 0,
              seller: { id: 'seller-1' },
            };
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        bid: {
          create: jest.fn().mockResolvedValue({ id: 'b-1', placedAt: new Date() }),
        },
        auditLog: { create: jest.fn().mockResolvedValue({}) },
        notification: { create: jest.fn().mockResolvedValue({}) },
        $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
      };

      const mockProxy: any = {
        evaluateProxyBids: jest.fn().mockResolvedValue({ triggered: false }),
      };

      const service = new BiddingService(mockPrisma, mockRedis, mockProxy);

      const results = await Promise.allSettled([
        service.placeBid('buyer-1111', { auctionId: 'a-conc-1', amount: 51000 }),
        service.placeBid('buyer-2222', { auctionId: 'a-conc-1', amount: 52000 }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    });
  });

  describe('4. Mandatory Reasons & Audit Accountability', () => {
    it('should require a documented reason when suspending a user account', async () => {
      const usersService = new UsersService({} as any, { record: jest.fn() } as any);
      await expect(
        usersService.updateUserStatus('u-target', 'admin-1', UserStatus.SUSPENDED, ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require a policy reason when deciding bid security forfeiture', async () => {
      const secService = new BidSecurityService({} as any, { record: jest.fn() } as any);
      await expect(
        secService.decideForfeiture('dep-1', 'fin-1', 'FORFEITED', ''),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
