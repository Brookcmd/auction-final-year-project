import { IsNotEmpty, IsNumber, IsString, Min, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlaceBidDto {
  @ApiProperty({ description: 'The unique auction identifier' })
  @IsString()
  @IsNotEmpty()
  auctionId: string;

  @ApiProperty({ example: 4550000, description: 'Bid amount in ETB' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiPropertyOptional({ description: 'Idempotency key to prevent accidental duplicate submissions' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
