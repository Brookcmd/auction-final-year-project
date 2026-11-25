import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemCondition } from '@prisma/client';

export class CreateAuctionDto {
  @ApiProperty({ example: 'Toyota Land Cruiser Prado 2021 TX' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Fully inspected, excellent condition, 45,000 km, customs cleared in Addis Ababa.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'cat-vehicles-uuid' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ enum: ItemCondition, default: ItemCondition.USED })
  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @ApiPropertyOptional({ example: 'Addis Ababa' })
  @IsOptional()
  @IsString()
  locationCity?: string;

  @ApiProperty({ example: 4500000, description: 'Starting bid in ETB' })
  @IsNumber()
  @Min(1)
  startingPrice: number;

  @ApiPropertyOptional({ example: 5000000, description: 'Optional secret reserve price in ETB' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  reservePrice?: number;

  @ApiPropertyOptional({ example: 25000, default: 100, description: 'Minimum bid increment in ETB' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  bidIncrement?: number;

  @ApiProperty({ example: '2026-11-25T10:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-11-28T18:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://images.unsplash.com/photo-1533473359331-0135ef1b58bf'],
  })
  @IsOptional()
  @IsArray()
  imageUrls?: string[];
}
