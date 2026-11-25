import { Test, TestingModule } from '@nestjs/testing';
import { ProxyBiddingService } from './proxy-bidding.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ProxyBiddingService (Unit Tests)', () => {
  let proxyService: ProxyBiddingService;
  let prismaService: any;

  beforeEach(async () => {
    prismaService = {
      proxyBid: {
        findMany: jest.fn(),
        upsert: jest.fn(),
      },
      bid: {
        create: jest.fn().mockResolvedValue({ id: 'proxy-bid-1' }),
      },
      auction: {
        update: jest.fn().mockResolvedValue({ id: 'auction-1' }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProxyBiddingService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    proxyService = module.get<ProxyBiddingService>(ProxyBiddingService);
  });

  it('should auto-bid the minimal increment on behalf of proxy bidder', async () => {
    // Current highest: 5,000 ETB by User B
    // User A has proxy limit of 8,000 ETB
    // Increment: 100 ETB
    prismaService.proxyBid.findMany.mockResolvedValueOnce([
      {
        bidderId: 'user-A-proxy',
        maxAmount: 8000,
        isActive: true,
      },
    ]);

    const result = await proxyService.evaluateProxyBids(
      'auction-coffee',
      5000,
      'user-B-manual',
      100,
    );

    expect(result.triggered).toBe(true);
    // User A should automatically counter-bid 5,100 ETB (minimum necessary)
    expect(result.newHighestBid).toBe(5100);
    expect(result.newBidderId).toBe('user-A-proxy');
  });

  it('should resolve competing proxy limits fairly without exceeding ceiling', async () => {
    // Current highest: 5,000 ETB
    // User A proxy max: 8,000 ETB
    // User C proxy max: 7,000 ETB
    // Increment: 100 ETB
    prismaService.proxyBid.findMany.mockResolvedValueOnce([
      { bidderId: 'user-A', maxAmount: 8000, isActive: true },
      { bidderId: 'user-C', maxAmount: 7000, isActive: true },
    ]);

    const result = await proxyService.evaluateProxyBids(
      'auction-coffee',
      5000,
      'user-B-manual',
      100,
    );

    expect(result.triggered).toBe(true);
    // User A wins against User C at User C's max + 1 increment (7,100 ETB)
    expect(result.newHighestBid).toBe(7100);
    expect(result.newBidderId).toBe('user-A');
  });
});
