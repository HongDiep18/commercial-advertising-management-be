import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdOrderStatus } from '@prisma/client';

export class AdminApproveOrderDto {
  @ApiPropertyOptional({
    description: 'Optional reason or notes for approval',
    example: 'All assets verified and approved',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AdminRejectOrderDto {
  @ApiProperty({
    description: 'Reason for rejection',
    example: 'Assets do not meet quality standards',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  reason: string;
}

export class AdminOrderActionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AdOrderStatus })
  status: AdOrderStatus;

  @ApiProperty()
  lastUpdatedBy: string;

  @ApiProperty()
  lastUpdatedAt: Date;

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  message: string;
}
