import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuctionsService } from './auctions.service';
import { CreateAuctionDto } from './dto/create-auction.dto';
import { QueryAuctionsDto } from './dto/query-auctions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, AuctionStatus } from '@prisma/client';

@ApiTags('Auctions & Governance')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  @ApiOperation({ summary: 'Explore and search public active auctions with filters and pagination' })
  async findAll(@Query() query: QueryAuctionsDto) {
    return this.auctionsService.findAll(query);
  }

  @Get('verify/:itemCode')
  @ApiOperation({ summary: 'Public QR item verification page data (safe public attributes only)' })
  async verifyQrItem(@Param('itemCode') itemCode: string) {
    return this.auctionsService.getPublicQrVerification(itemCode);
  }

  @Get('governance/queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: View listings governance review queue' })
  async getGovernanceQueue() {
    return this.auctionsService.getGovernanceQueue();
  }

  @Get('seller/my-listings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller: Get all auctions created by authenticated seller' })
  async getSellerAuctions(@CurrentUser('id') sellerId: string) {
    return this.auctionsService.getSellerAuctions(sellerId);
  }

  @Get('buyer/my-bids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: Get all auctions where buyer placed bids' })
  async getBuyerBids(@CurrentUser('id') buyerId: string) {
    return this.auctionsService.getBuyerBids(buyerId);
  }

  @Get('buyer/watchlist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: Get user saved watchlist auctions' })
  async getBuyerWatchlist(@CurrentUser('id') userId: string) {
    return this.auctionsService.getBuyerWatchlist(userId);
  }

  @Get('buyer/won-auctions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buyer: Get all auctions won by user' })
  async getBuyerWonAuctions(@CurrentUser('id') userId: string) {
    return this.auctionsService.getBuyerWonAuctions(userId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get detailed auction view with live bid history and inspection status' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.auctionsService.findOne(id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.SUPER_ADMIN, Role.ADMIN, Role.AUCTION_MANAGER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new auction listing (Draft, Submitted, or Inspection Required)' })
  async create(@CurrentUser('id') sellerId: string, @Body() dto: CreateAuctionDto) {
    return this.auctionsService.create(sellerId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller: Edit listing while still in Draft or Additional Info Required' })
  async updateDraft(
    @Param('id') auctionId: string,
    @CurrentUser('id') sellerId: string,
    @Body() dto: Partial<CreateAuctionDto>,
  ) {
    return this.auctionsService.updateDraftListing(auctionId, sellerId, dto);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Seller: Submit draft listing for administrative governance approval' })
  async submitForReview(
    @Param('id') auctionId: string,
    @CurrentUser('id') sellerId: string,
  ) {
    return this.auctionsService.submitForReview(auctionId, sellerId);
  }

  @Post('governance/:id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: Approve, schedule, publish, pause, reject, or cancel listing' })
  async reviewAuction(
    @Param('id') auctionId: string,
    @CurrentUser('id') reviewerId: string,
    @Body()
    body: {
      status: AuctionStatus;
      reason?: string;
      startTime?: string;
      endTime?: string;
      requiresInspection?: boolean;
      requiresBidSecurity?: boolean;
    },
  ) {
    return this.auctionsService.reviewAuction(auctionId, reviewerId, body);
  }

  @Post(':id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verified Buyer: Apply to participate in a restricted auction' })
  async applyRestricted(@Param('id') auctionId: string, @CurrentUser('id') userId: string) {
    return this.auctionsService.applyForRestrictedAuction(auctionId, userId);
  }

  @Put(':id/participants/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Auction Manager: Approve or reject restricted auction participant' })
  async reviewParticipation(
    @Param('id') auctionId: string,
    @Param('userId') participantId: string,
    @CurrentUser('id') reviewerId: string,
    @Body('status') status: string,
  ) {
    return this.auctionsService.reviewParticipation(auctionId, participantId, status, reviewerId);
  }

  @Post(':id/watchlist')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle follow/watchlist for this auction' })
  async toggleWatchlist(
    @Param('id') auctionId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.auctionsService.toggleWatchlist(userId, auctionId);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Report a suspicious or policy-violating auction listing' })
  async reportAuction(
    @Param('id') auctionId: string,
    @CurrentUser('id') userId: string,
    @Body('reason') reason: string,
    @Body('details') details?: string,
  ) {
    return this.auctionsService.reportAuction(userId, auctionId, reason, details);
  }

  @Put('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.AUCTION_MANAGER, Role.SUPER_ADMIN, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Moderate and update auction status' })
  async updateAuctionStatus(
    @Param('id') auctionId: string,
    @CurrentUser('id') reviewerId: string,
    @Body('status') status: AuctionStatus,
    @Body('reason') reason?: string,
  ) {
    return this.auctionsService.updateAuctionStatus(auctionId, status, reviewerId, reason);
  }
}
