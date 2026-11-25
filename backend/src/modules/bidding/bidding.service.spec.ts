import { Test, TestingModule } from '@nestjs/testing';
import { BiddingService } from './bidding.service';
import { ProxyBiddingService } from './proxy-bidding.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { AuctionStatus } from '@prisma/client';

describe('BiddingService & Real-Time Engine (Unit Tests)', () => {
  let biddingService: BiddingService;
  let redisService: RedisService;
  let prismaService: any;
  let proxyBiddingService: any;

  const mockAuction = {
    id: 'auction-prado-001',
    sellerId: 'seller-sarbet',
    title: '2022 Toyota Land Cruiser Prado',
    status: AuctionStatus.ACTIVE,
    startingPrice: 6500000,
    currentHighestBid: 6850000,
    bidIncrement: 50000,
    winningBidderId: 'buyer-helen',
    endTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes in future
    antiSnipingExtensions: 0,
    totalBidsCount: 4,
    seller: { id: 'seller-sarbet' },
  };

  beforeEach(async () => {
    prismaService = {
      auction: {
        findUnique: jest.fn().mockResolvedValue(mockAuction),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockAuction, ...data })),
      },
      bid: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'bid-new-1', ...data, placedAt: new Date() })),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    proxyBiddingService = {
      evaluateProxyBids: jest.fn().mockResolvedValue({ triggered: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiddingService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: RedisService,
          useValue: {
            acquireLock: jest.fn().mockResolvedValue({ acquired: true, token: 'mock-token' }),
            releaseLock: jest.fn().mockResolvedValue(true),
            setAuctionState: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: ProxyBiddingService, useValue: proxyBiddingService },
      ],
    }).compile();

    biddingService = module.get<BiddingService>(BiddingService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe('Bid Increment & Validation Rules', () => {
    it('should accept a valid bid that meets or exceeds current + increment', async () => {
      const validAmount = 6900000; // current 6,850,000 + inc 50,000
      const result = await biddingService.placeBid('buyer-solomon', {
        auctionId: 'auction-prado-001',
        amount: validAmount,
      });

      expect(result.success).toBe(true);
      expect(result.amount).toBe(validAmount);
      expect(result.bidderAlias).toBe('Bidder #OMON');
      expect(result.antiSnipingExtended).toBe(false);
    });

    it('should reject a bid that does not meet the minimum required increment', async () => {
      const lowAmount = 6860000; // Only +10,000, required is +50,000
      await expect(
        biddingService.placeBid('buyer-solomon', {
          auctionId: 'auction-prado-001',
          amount: lowAmount,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a bid if placed by the auction seller (prevent self-shill)', async () => {
      await expect(
        biddingService.placeBid('seller-sarbet', {
          auctionId: 'auction-prado-001',
          amount: 6900000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject a bid if the bidder is already the winning bidder', async () => {
      await expect(
        biddingService.placeBid('buyer-helen', {
          auctionId: 'auction-prado-001',
          amount: 6900000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a bid if the auction has already ended', async () => {
      prismaService.auction.findUnique.mockResolvedValueOnce({
        ...mockAuction,
        status: AuctionStatus.ENDED,
      });

      await expect(
        biddingService.placeBid('buyer-solomon', {
          auctionId: 'auction-prado-001',
          amount: 6900000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Anti-Sniping Soft-Close Rule', () => {
    it('should extend auction by 30 seconds when bid is placed within final 30 seconds', async () => {
      const almostEndedAuction = {
        ...mockAuction,
        endTime: new Date(Date.now() + 15 * 1000), // Only 15 seconds remaining!
      };
      prismaService.auction.findUnique.mockResolvedValueOnce(almostEndedAuction);

      const result = await biddingService.placeBid('buyer-solomon', {
        auctionId: 'auction-prado-001',
        amount: 6900000,
      });

      expect(result.antiSnipingExtended).toBe(true);
      const originalTime = almostEndedAuction.endTime.getTime();
      const extendedTime = new Date(result.newEndTime).getTime();
      expect(extendedTime - originalTime).toBe(30000); // Exactly +30 seconds
    });
  });
});
