import {
  Controller,
  Get,
  Post,
  Put,
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

@ApiTags('Auctions')
@Controller('auctions')
export class AuctionsController {
  constructor(private readonly auctionsService: AuctionsService) {}

  @Get()
  @ApiOperation({ summary: 'Explore and search auctions with filters and pagination' })
  async findAll(@Query() query: QueryAuctionsDto) {
    return this.auctionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get detailed auction view with live bid history' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.id;
    return this.auctionsService.findOne(id, userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new auction listing (Seller or Admin)' })
  async create(@CurrentUser('id') sellerId: string, @Body() dto: CreateAuctionDto) {
    return this.auctionsService.create(sellerId, dto);
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

  @Get('seller/my-listings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER, Role.ADMIN)
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

  @Put('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin: Moderate and update auction status' })
  async updateAuctionStatus(
    @Param('id') auctionId: string,
    @Body('status') status: AuctionStatus,
  ) {
    return this.auctionsService.updateAuctionStatus(auctionId, status);
  }
}
