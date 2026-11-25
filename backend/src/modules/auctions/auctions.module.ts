import { Module } from '@nestjs/common';
import { AuctionsService } from './auctions.service';
import { AuctionsController } from './auctions.controller';
import { AuctionTimerService } from './auction-timer.service';
import { BiddingModule } from '../bidding/bidding.module';

@Module({
  imports: [BiddingModule],
  controllers: [AuctionsController],
  providers: [AuctionsService, AuctionTimerService],
  exports: [AuctionsService],
})
export class AuctionsModule {}
