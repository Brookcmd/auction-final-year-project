import { Controller, Post, Body, Param, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BiddingService } from './bidding.service';
import { ProxyBiddingService } from './proxy-bidding.service';
import { BiddingGateway } from './bidding.gateway';
import { PlaceBidDto } from './dto/place-bid.dto';
import { SetProxyBidDto } from './dto/set-proxy-bid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Bidding Engine')
@Controller('bidding')
export class BiddingController {
  constructor(
    private readonly biddingService: BiddingService,
    private readonly proxyBiddingService: ProxyBiddingService,
    private readonly biddingGateway: BiddingGateway,
  ) {}

  @Post('bid')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a new bid via HTTP REST fallback (also broadcasts over WebSockets)' })
  async placeBid(
    @CurrentUser('id') userId: string,
    @Body() dto: PlaceBidDto,
    @Req() req: any,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    const result = await this.biddingService.placeBid(userId, dto, ip);
    this.biddingGateway.emitBidAccepted(result);
    return result;
  }

  @Post('proxy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Configure or update automatic proxy bidding ceiling' })
  async setProxyBid(
    @CurrentUser('id') userId: string,
    @Body() dto: SetProxyBidDto,
  ) {
    return this.proxyBiddingService.setProxyBid(userId, dto.auctionId, dto.maxAmount);
  }

  @Get('history/:auctionId')
  @ApiOperation({ summary: 'Get recent verified bid history for an auction' })
  async getRecentBids(@Param('auctionId') auctionId: string) {
    return this.biddingService.getRecentBids(auctionId, 30);
  }
}
