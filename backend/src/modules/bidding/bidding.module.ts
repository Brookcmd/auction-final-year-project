import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BiddingService } from './bidding.service';
import { ProxyBiddingService } from './proxy-bidding.service';
import { BiddingGateway } from './bidding.gateway';
import { BiddingController } from './bidding.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [BiddingController],
  providers: [BiddingService, ProxyBiddingService, BiddingGateway],
  exports: [BiddingService, ProxyBiddingService, BiddingGateway],
})
export class BiddingModule {}
