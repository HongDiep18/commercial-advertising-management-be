import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class WriteNewsSummaryDto {
  @ApiProperty({ description: 'Vietnamese summary' })
  @IsString()
  @Length(1, 20000)
  aiSummaryVi: string;

  @ApiProperty({ description: 'Traditional Chinese (zh-TW) summary' })
  @IsString()
  @Length(1, 20000)
  aiSummaryZhTw: string;

  @ApiProperty({ description: 'English summary' })
  @IsString()
  @Length(1, 20000)
  aiSummaryEn: string;

  @ApiPropertyOptional({ example: 'gpt-4.1-mini' })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  aiModel?: string;

  @ApiPropertyOptional({ example: ['business', 'policy'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Length(1, 128, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}
