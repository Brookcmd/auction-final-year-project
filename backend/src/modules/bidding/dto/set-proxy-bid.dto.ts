import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetProxyBidDto {
  @ApiProperty({ description: 'The unique auction identifier' })
  @IsString()
  @IsNotEmpty()
  auctionId: string;

  @ApiProperty({ example: 5000000, description: 'Maximum ceiling amount in ETB the system can automatically bid up to' })
  @IsNumber()
  @Min(1)
  maxAmount: number;
}
