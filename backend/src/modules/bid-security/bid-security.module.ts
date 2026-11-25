import { Module } from '@nestjs/common';
import { BidSecurityService } from './bid-security.service';
import { BidSecurityController } from './bid-security.controller';

@Module({
  controllers: [BidSecurityController],
  providers: [BidSecurityService],
  exports: [BidSecurityService],
})
export class BidSecurityModule {}
