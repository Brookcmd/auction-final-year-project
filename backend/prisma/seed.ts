import {
  PrismaClient,
  Role,
  UserStatus,
  ItemCondition,
  AuctionStatus,
  PaymentStatus,
  TransactionWorkflowStatus,
  DeliveryStatus,
  PaymentProvider,
  NotificationType,
  VerificationStatus,
  DepositStatus,
  InspectionCategoryType,
  ConditionGrade,
  DisputeCategory,
  DisputeStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting BIDORA Managed Ecosystem seeding...');

  // Clean tables in reverse dependency order
  await prisma.disputeMessage.deleteMany();
  await prisma.disputeEvidence.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.delivery.deleteMany();
  await prisma.deliveryPartner.deleteMany();
  await prisma.financialLedgerEntry.deleteMany();
  await prisma.bidSecurityDeposit.deleteMany();
  await prisma.bidSecurityPolicy.deleteMany();
  await prisma.inspectionReport.deleteMany();
  await prisma.inspectionAssignment.deleteMany();
  await prisma.inspectionRequest.deleteMany();
  await prisma.inspectionPartner.deleteMany();
  await prisma.auctionApproval.deleteMany();
  await prisma.auctionParticipation.deleteMany();
  await prisma.documentAccessLog.deleteMany();
  await prisma.verificationRequest.deleteMany();
  await prisma.suspiciousActivityFlag.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.report.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.bid.deleteMany();
  await prisma.proxyBid.deleteMany();
  await prisma.auctionImage.deleteMany();
  await prisma.auction.deleteMany();
  await prisma.category.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.platformSetting.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.user.deleteMany();

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('BidoraDev2026!', salt);

  // 1. Create Super Admin & Specialized Staff Roles
  const superAdmin = await prisma.user.create({
    data: {
      email: 'admin@bidora.et',
      passwordHash,
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Kibret Mengistu (Super Admin)',
          phoneNumber: '+251911000001',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  const auctionManager = await prisma.user.create({
    data: {
      email: 'manager.auction@bidora.et',
      passwordHash,
      role: Role.AUCTION_MANAGER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Sara Mekonnen (Auction Manager)',
          phoneNumber: '+251911000002',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'officer.verify@bidora.et',
      passwordHash,
      role: Role.VERIFICATION_OFFICER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Abebe Girma (Verification Officer)',
          phoneNumber: '+251911000003',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'officer.finance@bidora.et',
      passwordHash,
      role: Role.FINANCE_OFFICER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Tigist Haile (Finance Officer)',
          phoneNumber: '+251911000004',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  const supportOfficer = await prisma.user.create({
    data: {
      email: 'officer.support@bidora.et',
      passwordHash,
      role: Role.SUPPORT_OFFICER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Mulugeta Desta (Support Officer)',
          phoneNumber: '+251911000005',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  // 2. Inspection Partner Account
  const inspectorUser = await prisma.user.create({
    data: {
      email: 'inspector.ethio@bidora.et',
      passwordHash,
      role: Role.INSPECTION_PARTNER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Eng. Yohannes Alemu (EthioCheck Inspections)',
          phoneNumber: '+251911778899',
          city: 'Addis Ababa',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  const inspectorPartner = await prisma.inspectionPartner.create({
    data: {
      userId: inspectorUser.id,
      companyName: 'EthioCheck Technical Inspections PLC',
      contactName: 'Eng. Yohannes Alemu',
      phone: '+251911778899',
      email: 'inspector.ethio@bidora.et',
      serviceLocations: 'Addis Ababa, Adama, Hawassa',
      supportedCategories: 'VEHICLES,MACHINERY,ELECTRONICS,AGRICULTURAL_EQUIPMENT',
      qualifications: 'Certified Automotive & Heavy Machinery Appraisal Engineers (12+ yrs)',
      businessRegNumber: 'ET-INSP-90421',
      yearsExperience: 12,
      approvalStatus: 'APPROVED',
      approvedById: superAdmin.id,
      approvedAt: new Date(),
    },
  });

  // 3. Sellers & Buyers
  const seller1 = await prisma.user.create({
    data: {
      email: 'seller.motors@bidora.et',
      passwordHash,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Abyssinia Premium Fleet Ltd',
          phoneNumber: '+251911223344',
          city: 'Addis Ababa',
          address: 'Sarbet, Near African Union',
          businessName: 'Abyssinia Premium Fleet PLC',
          businessRegNumber: 'AA-TRADE-44812',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  const seller2 = await prisma.user.create({
    data: {
      email: 'seller.agro@bidora.et',
      passwordHash,
      role: Role.SELLER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Rift Valley Agro Export Co.',
          phoneNumber: '+251922334455',
          city: 'Hawassa',
          address: 'Industrial Park Zone 2',
          businessName: 'Rift Valley Agro Export Co.',
          businessRegNumber: 'HW-AGRO-11290',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
        },
      },
    },
  });

  const buyer1 = await prisma.user.create({
    data: {
      email: 'buyer.solomon@bidora.et',
      passwordHash,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Solomon Tadesse',
          phoneNumber: '+251933445566',
          city: 'Addis Ababa',
          address: 'Kazanchis, Kirkos Sub-City',
          nationalIdNumber: 'FAYDA-88392011',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          escrowBalanceETB: 500000,
        },
      },
    },
  });

  const buyer2 = await prisma.user.create({
    data: {
      email: 'buyer.helen@bidora.et',
      passwordHash,
      role: Role.BUYER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      profile: {
        create: {
          fullName: 'Helen Berhanu',
          phoneNumber: '+251944556677',
          city: 'Adama',
          address: 'Main Commercial Ave',
          nationalIdNumber: 'FAYDA-99120445',
          isKycVerified: true,
          verificationStatus: VerificationStatus.VERIFIED,
          escrowBalanceETB: 850000,
        },
      },
    },
  });

  const buyer3 = await prisma.user.create({
    data: {
      email: 'buyer.dawit@bidora.et',
      passwordHash,
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
          verificationStatus: VerificationStatus.PENDING_REVIEW,
        },
      },
    },
  });

  // Pending KYC Verification Request for Verification Officer demo
  await prisma.verificationRequest.create({
    data: {
      userId: buyer3.id,
      applicantType: 'BUYER',
      legalName: 'Dawit Bekele',
      phoneNumber: '+251955667788',
      idType: 'Ethiopian National ID (Fayda)',
      idNumber: 'FAYDA-77210034',
      address: 'Bahir Dar, Kebele 04',
      documentFrontUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=800&q=80',
      status: VerificationStatus.PENDING_REVIEW,
    },
  });

  // 4. Categories
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

  // 5. Bid Security Policies
  const vehiclePolicy = await prisma.bidSecurityPolicy.create({
    data: {
      name: 'High-Value Vehicle Bid Bond (Fixed ETB 25,000)',
      categoryId: categoriesMap.get('vehicles')!,
      requiresDeposit: true,
      depositType: 'FIXED',
      fixedAmountETB: 25000,
      minDepositETB: 10000,
      maxDepositETB: 100000,
      eligibleProviders: 'TELEBIRR,CBE_BIRR,BANK_TRANSFER',
      paymentDeadlineHours: 72,
      refundPolicy: 'Non-winning bidders become eligible for full simulated deposit refund after auction completion.',
      forfeiturePolicy: 'Winner failing to complete simulated payment within 72 hours triggers Finance Officer forfeiture review.',
    },
  });

  // 6. Auctions (Active with Bid Security + Approved Inspection + QR, Active No Deposit, Pending Review, Completed)
  const now = new Date();
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const thirtyMinsFromNow = new Date(now.getTime() + 30 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Auction 1: Active Vehicle with Bid Security + Approved Inspection + QR Code!
  const auction1 = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('vehicles')!,
      itemCode: 'BID-2026-PRADO1',
      title: '2022 Toyota Land Cruiser Prado TXL 2.8L Diesel',
      description: 'Single corporate owner, 38,000 km, fully maintained at Moenco Addis Ababa. Inspected by EthioCheck Technical Inspections PLC.',
      condition: ItemCondition.LIKE_NEW,
      locationCity: 'Addis Ababa',
      startingPrice: 6500000,
      currentHighestBid: 6850000,
      reservePrice: 6700000,
      bidIncrement: 50000,
      status: AuctionStatus.ACTIVE,
      requiresBidSecurity: true,
      requiresInspection: true,
      bidSecurityPolicyId: vehiclePolicy.id,
      approvedById: auctionManager.id,
      approvedAt: yesterday,
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

  // Confirmed Bid Security Deposits for Auction 1 (Solomon & Helen eligible; Dawit NOT eligible!)
  const solomonDeposit = await prisma.bidSecurityDeposit.create({
    data: {
      buyerId: buyer1.id,
      auctionId: auction1.id,
      policyId: vehiclePolicy.id,
      amount: 25000,
      paymentProvider: PaymentProvider.TELEBIRR,
      paymentReference: 'DEP_SIM_TELEBIRR_1001',
      status: DepositStatus.CONFIRMED,
    },
  });
  await prisma.bidSecurityDeposit.create({
    data: {
      buyerId: buyer2.id,
      auctionId: auction1.id,
      policyId: vehiclePolicy.id,
      amount: 25000,
      paymentProvider: PaymentProvider.CBE_BIRR,
      paymentReference: 'DEP_SIM_CBE_1002',
      status: DepositStatus.CONFIRMED,
    },
  });
  await prisma.financialLedgerEntry.createMany({
    data: [
      {
        depositId: solomonDeposit.id,
        userId: buyer1.id,
        entryType: 'DEPOSIT_CONFIRMED',
        amount: 25000,
        isSimulated: true,
        reference: 'DEP_SIM_TELEBIRR_1001',
        notes: 'Simulated bid bond for Prado auction',
      },
    ],
  });

  // Approved Inspection Request & Report for Auction 1
  const inspReq1 = await prisma.inspectionRequest.create({
    data: {
      auctionId: auction1.id,
      requestedById: seller1.id,
      categoryType: InspectionCategoryType.VEHICLES,
      status: 'APPROVED',
      locationAddress: 'Sarbet Depot, Addis Ababa',
      scheduledAt: yesterday,
    },
  });
  await prisma.inspectionAssignment.create({
    data: {
      requestId: inspReq1.id,
      partnerId: inspectorPartner.id,
      assignedById: auctionManager.id,
      status: 'COMPLETED',
      feeETB: 3500,
      respondedAt: yesterday,
    },
  });
  await prisma.inspectionReport.create({
    data: {
      reportCode: 'INSP-2026-PRADO1',
      requestId: inspReq1.id,
      auctionId: auction1.id,
      partnerId: inspectorPartner.id,
      categoryType: InspectionCategoryType.VEHICLES,
      conditionGrade: ConditionGrade.EXCELLENT,
      checklistJson: JSON.stringify({
        'Engine condition & idle smoothness': 'Pass — Clean 2.8L D-4D idle, no leaks',
        'Exterior body & paint condition': 'Pass — Original factory paint',
        'Odometer / mileage reading verification': '38,140 km verified',
        'Tire tread depth & wheel alignment': '85% tread remaining',
      }),
      observations: 'Vehicle passed full 7-point mechanical and structural inspection with zero accident history.',
      defectsAndLimitations: 'Minor scuff on rear cargo mat; spare key present.',
      inspectorRemarks: 'Recommended for public auction listing.',
      inspectionLocation: 'Sarbet Depot, Addis Ababa',
      adminReviewStatus: 'APPROVED',
      reviewedById: auctionManager.id,
      reviewedAt: yesterday,
      reviewNotes: 'Approved for buyer visibility.',
    },
  });

  await prisma.bid.createMany({
    data: [
      { auctionId: auction1.id, bidderId: buyer2.id, amount: 6550000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 100 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer1.id, amount: 6650000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 80 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer2.id, amount: 6750000, bidderAlias: 'Bidder #6677', placedAt: new Date(now.getTime() - 50 * 60 * 1000) },
      { auctionId: auction1.id, bidderId: buyer1.id, amount: 6850000, bidderAlias: 'Bidder #5566', placedAt: new Date(now.getTime() - 20 * 60 * 1000) },
    ],
  });

  // Auction 2: Open Active Auction (No Bid Security required — easy live bidding test)
  const auction2 = await prisma.auction.create({
    data: {
      sellerId: seller2.id,
      categoryId: categoriesMap.get('agriculture')!,
      itemCode: 'BID-2026-COF02',
      title: 'Bulk Premium Grade-1 Yirgacheffe Washed Green Coffee (50 Bags / 3,000 KG)',
      description: 'Certified Specialty Grade 1 Arabica from Gedeo Zone, Yirgacheffe. Moisture content 10.8%, cupping score 88.5.',
      condition: ItemCondition.BRAND_NEW,
      locationCity: 'Hawassa',
      startingPrice: 1200000,
      currentHighestBid: 1350000,
      reservePrice: 1300000,
      bidIncrement: 25000,
      status: AuctionStatus.ACTIVE,
      requiresBidSecurity: false,
      approvedById: auctionManager.id,
      approvedAt: yesterday,
      startTime: yesterday,
      endTime: thirtyMinsFromNow,
      originalEndTime: thirtyMinsFromNow,
      winningBidderId: buyer2.id,
      totalBidsCount: 4,
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

  // Auction 3: Pending Inspection / Governance Review (for Auction Manager & Inspector demo!)
  const auction3 = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('machinery')!,
      title: 'Perkins 150kVA Silent Diesel Generator Set with ATS',
      description: 'Low-hour standby generator (320 operating hours). Awaiting independent inspection and Auction Manager approval.',
      condition: ItemCondition.USED,
      locationCity: 'Addis Ababa',
      startingPrice: 1800000,
      currentHighestBid: 1800000,
      bidIncrement: 20000,
      status: AuctionStatus.INSPECTION_PENDING,
      requiresInspection: true,
      requiresBidSecurity: true,
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

  const inspReq3 = await prisma.inspectionRequest.create({
    data: {
      auctionId: auction3.id,
      requestedById: seller1.id,
      categoryType: InspectionCategoryType.MACHINERY,
      status: 'ASSIGNED',
      locationAddress: 'Kazanchis Warehouse 4, Addis Ababa',
      notes: 'Generator load test requested before auction approval.',
    },
  });
  await prisma.inspectionAssignment.create({
    data: {
      requestId: inspReq3.id,
      partnerId: inspectorPartner.id,
      assignedById: auctionManager.id,
      status: 'PENDING',
      feeETB: 3000,
    },
  });

  // Auction 4: Completed Auction with Digital Agreement, Delivery Partner & Simulated Transaction
  const completedAuction = await prisma.auction.create({
    data: {
      sellerId: seller1.id,
      categoryId: categoriesMap.get('electronics')!,
      itemCode: 'BID-2026-MAC10',
      title: 'Lot of 10x Apple MacBook Pro 16" M2 Pro (32GB RAM, 512GB SSD)',
      description: 'Tech startup office surplus. All laptops in pristine functional condition with original 140W USB-C power adapters.',
      condition: ItemCondition.LIKE_NEW,
      locationCity: 'Addis Ababa',
      startingPrice: 900000,
      currentHighestBid: 1150000,
      bidIncrement: 15000,
      status: AuctionStatus.ENDED,
      approvedById: auctionManager.id,
      approvedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
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

  const deliveryPartner = await prisma.deliveryPartner.create({
    data: {
      name: 'Addis Express Cargo & Logistics',
      phone: '+251911889900',
      email: 'dispatch@addisexpress.et',
      serviceCities: 'Addis Ababa, Adama, Hawassa, Bahir Dar',
    },
  });

  const tx = await prisma.transaction.create({
    data: {
      agreementNumber: 'AGR-2026-MAC10',
      auctionId: completedAuction.id,
      buyerId: buyer1.id,
      sellerId: seller1.id,
      finalAmount: 1150000,
      platformFeeETB: 28750,
      appliedDepositETB: 0,
      paymentStatus: PaymentStatus.IN_ESCROW,
      workflowStatus: TransactionWorkflowStatus.IN_DELIVERY,
      deliveryStatus: DeliveryStatus.IN_TRANSIT,
      paymentProvider: PaymentProvider.TELEBIRR,
      paymentReference: 'TB_SIM_2026_998124',
      paymentDeadline: threeDaysFromNow,
    },
  });

  await prisma.delivery.create({
    data: {
      transactionId: tx.id,
      deliveryOption: 'DELIVERY_PARTNER',
      partnerId: deliveryPartner.id,
      pickupAddress: 'Sarbet Depot, Addis Ababa',
      deliveryAddress: 'Kazanchis, Kirkos Sub-City, Addis Ababa',
      shippingFeeETB: 1500,
      status: DeliveryStatus.IN_TRANSIT,
      trackingCode: 'TRK-ADDIS-8821',
      scheduledDate: now,
    },
  });

  await prisma.payment.create({
    data: {
      transactionId: tx.id,
      amount: 1150000,
      provider: PaymentProvider.TELEBIRR,
      providerRef: 'TB_SIM_2026_998124',
      status: 'SIMULATED_SUCCESS',
      isSimulated: true,
      rawResponse: '{"simulated":true,"status":"TRANSACTION_SUCCESS","provider":"TELEBIRR"}',
    },
  });

  // 7. Sample Dispute for Support Officer Demo
  await prisma.dispute.create({
    data: {
      disputeCode: 'DSP-2026-DEMO1',
      auctionId: auction2.id,
      openedById: buyer2.id,
      assignedAdminId: supportOfficer.id,
      category: DisputeCategory.INSPECTION_DISAGREEMENT,
      reason: 'Requesting verification of coffee bag moisture test certificate before closing',
      description: 'Would like confirmation of ECX moisture lab sheet prior to final shipment.',
      status: DisputeStatus.UNDER_REVIEW,
    },
  });

  // 8. Platform Settings & Initial Audit Log
  await prisma.platformSetting.createMany({
    data: [
      { key: 'ANTI_SNIPING_EXTENSION_SECONDS', value: '30', description: 'Soft-close extension duration in seconds' },
      { key: 'PLATFORM_FEE_PERCENT', value: '2.5', description: 'Simulated platform service fee percentage' },
      { key: 'PAYMENT_ENVIRONMENT', value: 'SIMULATED_PROTOTYPE', description: 'Payment & deposit processing mode' },
    ],
  });

  await prisma.auditLog.create({
    data: {
      userId: superAdmin.id,
      action: 'SYSTEM_SEED_INITIALIZED',
      entityType: 'Platform',
      entityId: 'bidora-ecosystem',
      newState: JSON.stringify({ seededAt: now.toISOString(), environment: 'academic_demo' }),
      reason: 'Seeded BIDORA managed digital auction ecosystem demonstration dataset',
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: buyer1.id,
        title: 'Auction Won (Simulated Payment Submitted)',
        message: 'You won Lot of 10x Apple MacBook Pro 16" M2 Pro for ETB 1,150,000 (Agreement AGR-2026-MAC10).',
        type: NotificationType.AUCTION_WON,
        linkUrl: '/dashboard/buyer',
      },
      {
        userId: inspectorUser.id,
        title: 'New Inspection Assignment Pending',
        message: 'Perkins 150kVA Silent Diesel Generator Set requires inspection in Kazanchis.',
        type: NotificationType.INSPECTION_UPDATE,
        linkUrl: '/dashboard/inspector',
      },
    ],
  });

  console.log('✅ BIDORA Managed Ecosystem seed completed!');
  console.log('----------------------------------------------------');
  console.log('Demo Accounts (Password: BidoraDev2026!):');
  console.log('  Super Admin:          admin@bidora.et');
  console.log('  Auction Manager:      manager.auction@bidora.et');
  console.log('  Verification Officer: officer.verify@bidora.et');
  console.log('  Finance Officer:      officer.finance@bidora.et');
  console.log('  Support Officer:      officer.support@bidora.et');
  console.log('  Inspection Partner:   inspector.ethio@bidora.et');
  console.log('  Verified Seller:      seller.motors@bidora.et');
  console.log('  Verified Buyer:       buyer.solomon@bidora.et');
  console.log('  Verified Buyer 2:     buyer.helen@bidora.et');
  console.log('  Unverified Buyer:     buyer.dawit@bidora.et');
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
