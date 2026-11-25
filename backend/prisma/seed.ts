import { PrismaClient, Role, UserStatus, ItemCondition, AuctionStatus, PaymentStatus, DeliveryStatus, PaymentProvider, NotificationType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting BIDORA database seeding (Demonstration & Academic Evaluation Data)...');

  // Clear existing tables in reverse dependency order
  await prisma.suspiciousActivityFlag.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.proxyBid.deleteMany();
  await prisma.auctionImage.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('BidoraDev2026!', salt);

  // 1. Create Core Users
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Kibret Mengistu (Chief Admin)',
          phoneNumber: '+251911000001',
          city: 'Addis Ababa',
          address: 'Bole Medhanialem, Sub-City',
          isKycVerified: true,
        },
      },
    },
  });

  const seller1 = await prisma.user.create({
    data: {
      email: 'seller.motors@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Abyssinia Premium Fleet Ltd',
          phoneNumber: '+251911223344',
          city: 'Addis Ababa',
          address: 'Sarbet, Near African Union',
          isKycVerified: true,
        },
      },
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      email: 'seller.agro@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Rift Valley Agro Export Co.',
          phoneNumber: '+251922334455',
          city: 'Hawassa',
          address: 'Industrial Park Zone 2',
          isKycVerified: true,
        },
      },
    },
  });

  const buyer1 = await prisma.user.create({
    data: {
      email: 'buyer.solomon@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Solomon Tadesse',
          phoneNumber: '+251933445566',
          city: 'Addis Ababa',
          address: 'Kazanchis, Kirkos Sub-City',
          isKycVerified: true,
          escrowBalanceETB: 500000,
        },
      },
    },
  });

  const buyer2 = await prisma.user.create({
    data: {
      email: 'buyer.helen@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Helen Berhanu',
          phoneNumber: '+251944556677',
          city: 'Adama',
          address: 'Main Commercial Ave',
          isKycVerified: true,
          escrowBalanceETB: 850000,
        },
      },
    },
  });

  const buyer3 = await prisma.user.create({
    data: {
      email: 'buyer.dawit@bidora.et',
      passwordHash: defaultPasswordHash,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Dawit Bekele',
          phoneNumber: '+251955667788',
          city: 'Bahir Dar',
          address: 'Lake View Sector',
          isKycVerified: false,
        },
      },
    },
  });

  console.log('✅ Users & Profiles created');

  // 2. Create Marketplace Categories
  const categoriesData = [
    { name: 'Vehicles & Automotive', slug: 'vehicles', description: 'Cars, Commercial Trucks, SUVs, and Motorbikes', iconName: 'Car', displayOrder: 1 },
    { name: 'Electronics & IT', slug: 'electronics', description: 'Enterprise Servers, Laptops, Mobile Devices, Network Gear', iconName: 'Laptop', displayOrder: 2 },
    { name: 'Agricultural Products & Livestock', slug: 'agriculture', description: 'Coffee beans, Sesame, Grain lots, Farm equipment', iconName: 'Wheat', displayOrder: 3 },
    { name: 'Machinery & Industrial', slug: 'machinery', description: 'Generators, Construction equipment, Manufacturing tools', iconName: 'Cog', displayOrder: 4 },
    { name: 'Real Estate & Properties', slug: 'real-estate', description: 'Commercial warehouses, Residential plots, Office buildings', iconName: 'Building', displayOrder: 5 },
    { name: 'Furniture & Decor', slug: 'furniture', description: 'Executive office desks, Conference tables, Vintage home furnishings', iconName: 'Armchair', displayOrder: 6 },
    { name: 'Business Assets & Surplus', slug: 'business-assets', description: 'Liquidation assets, Hotel inventories, Restaurant gear', iconName: 'Briefcase', displayOrder: 7 },
  ];

  const categoriesMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const created = await prisma.category.create({ data: cat });
    categoriesMap.set(cat.slug, created.id);
  }

  console.log('✅ Categories created');

  // 3. Create Diverse Auctions (Active, Ending Soon, Completed, Upcoming)
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Auction 1: Ending Soon Vehicle (Great for testing live bidding & anti-sniping!)
  const auction1 = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('vehicles')!,
      title: '2022 Toyota Land Cruiser Prado TXL 2.8L Diesel',
      description: 'Single corporate owner, 38,000 km, fully maintained at Moenco Addis Ababa. Pristine condition, sunroof, leather seats, all customs duties cleared.',
      condition: ItemCondition.LIKE_NEW,
      locationCity: 'Addis Ababa',
      startingPrice: 6500000,
      currentHighestBid: 6850000,
      reservePrice: 6700000,
      bidIncrement: 50000,
      status: AuctionStatus.ACTIVE,
      startTime: yesterday,
      endTime: twoHoursFromNow,
      originalEndTime: twoHoursFromNow,
      winningBidderId: buyer1.id,
      totalBidsCount: 4,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80', displayOrder: 0, isCover: true },
          { url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80', displayOrder: 1, isCover: false },
        ],
      },
    },
  });

  // Bids on Auction 1
  await prisma.bid.createMany({
    data: [
      { auctionId: auction1.id, bidderId: buyer2.id, amount: 6550000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 100 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer1.id, amount: 6650000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 80 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer2.id, amount: 6750000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 50 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer1.id, amount: 6850000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 20 * 60 * 1000) },
    ],
  });

  // Auction 2: Urgent Live Auction ending in 30 minutes!
  const auction2 = await prisma.auction.create({
    data: {
      sellerId: seller2.id,
      categoryId: categoriesMap.get('agriculture')!,
      title: 'Bulk Premium Grade-1 Yirgacheffe Washed Green Coffee (50 Bags / 3,000 KG)',
      description: 'Certified Specialty Grade 1 Arabica from Gedeo Zone, Yirgacheffe. Moisture content 10.8%, cupping score 88.5. Warehouse ready for inspection in Hawassa.',
      condition: ItemCondition.BRAND_NEW,
      locationCity: 'Hawassa',
      startingPrice: 1200000,
      currentHighestBid: 1350000,
      reservePrice: 1300000,
      bidIncrement: 25000,
      status: AuctionStatus.ACTIVE,
      startTime: yesterday,
      endTime: thirtyMinsFromNow,
      originalEndTime: thirtyMinsFromNow,
      winningBidderId: buyer2.id,
      totalBidsCount: 3,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1587734195503-904fca47e0e9?auto=format&fit=crop&w=1200&q=80', displayOrder: 0, isCover: true },
        ],
      },
    },
  });

  await prisma.bid.createMany({
    data: [
      { auctionId: auction2.id, bidderId: buyer1.id, amount: 1250000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 40 * 60 * 1000) },
      { auctionId: auction2.id, bidderId: buyer2.id, amount: 1300000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 25 * 60 * 1000) },
      { auctionId: auction2.id, bidderId: buyer1.id, amount: 1325000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 10 * 60 * 1000) },
      { auctionId: auction2.id, bidderId: buyer2.id, amount: 1350000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 2 * 60 * 1000) },
    ],
  });

  // Auction 3: Industrial Generator
  const auction3 = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('machinery')!,
      title: 'Perkins 150kVA Silent Diesel Generator Set with ATS',
      description: 'Used low-hour standby generator (320 operating hours). Sound-attenuated weather enclosure, automatic transfer switch included. Located in Kazanchis.',
      condition: ItemCondition.USED,
      locationCity: 'Addis Ababa',
      startingPrice: 1800000,
      currentHighestBid: 1800000,
      bidIncrement: 20000,
      status: AuctionStatus.ACTIVE,
      startTime: now,
      endTime: threeDaysFromNow,
      originalEndTime: threeDaysFromNow,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80', displayOrder: 0, isCover: true },
        ],
      },
    },
  });

  // Auction 4: Completed Auction with Escrow Transaction
  const completedAuction = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('electronics')!,
      title: 'Lot of 10x Apple MacBook Pro 16" M2 Pro (32GB RAM, 512GB SSD)',
      description: 'Tech startup office surplus. All laptops in pristine functional condition with original 140W USB-C power adapters. Fully reset to factory macOS.',
      condition: ItemCondition.LIKE_NEW,
      locationCity: 'Addis Ababa',
      startingPrice: 900000,
      currentHighestBid: 1150000,
      bidIncrement: 15000,
      status: AuctionStatus.ENDED,
      startTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      endTime: yesterday,
      originalEndTime: yesterday,
      winningBidderId: buyer1.id,
      totalBidsCount: 5,
      images: {
        create: [
          { url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80', displayOrder: 0, isCover: true },
        ],
      },
    },
  });

  // Create Transaction for Completed Auction
  const tx = await prisma.transaction.create({
    data: {
      auctionId: completedAuction.id,
      buyerId: buyer1.id,
      sellerId: seller1.id,
      finalAmount: 1150000,
      paymentStatus: PaymentStatus.IN_ESCROW,
      deliveryStatus: DeliveryStatus.DISPATCHED,
      paymentProvider: PaymentProvider.TELEBIRR,
      paymentReference: 'TB_MOCK_2026_998124',
    },
  });

  await prisma.payment.create({
    data: {
      transactionId: tx.id,
      amount: 1150000,
      provider: PaymentProvider.TELEBIRR,
      providerRef: 'TB_MOCK_2026_998124',
      status: 'SUCCESS',
      rawResponse: '{"status":"TRANSACTION_SUCCESS","provider":"TELEBIRR","escrow":true}',
    },
  });

  // 4. Notifications
  await prisma.notification.createMany({
    data: [
      {
        userId: buyer1.id,
        title: '🎉 Auction Won!',
        message: 'You won the Lot of 10x Apple MacBook Pro 16" M2 Pro for ETB 1,150,000. Funds are safely in escrow.',
        type: NotificationType.AUCTION_WON,
        linkUrl: '/dashboard/won-auctions',
      },
      {
        userId: buyer2.id,
        title: '⚠️ You were outbid!',
        message: 'Another participant placed a higher bid on 2022 Toyota Land Cruiser Prado.',
        type: NotificationType.OUTBID,
        linkUrl: `/auctions/${auction1.id}`,
      },
    ],
  });

  console.log('✅ Demonstration seed data populated successfully!');
  console.log('----------------------------------------------------');
  console.log('Test Accounts (Password: BidoraDev2026!):');
  console.log('  Admin:  admin@bidora.et');
  console.log('  Seller: seller.motors@bidora.et');
  console.log('  Buyer:  buyer.solomon@bidora.et');
  console.log('  Buyer:  buyer.helen@bidora.et');
  console.log('----------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
