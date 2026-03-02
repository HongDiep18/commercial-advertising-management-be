import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class WriteNewsSummaryDto {
  @ApiProperty({ description: 'Vietnamese title (from RSS)' })
  @IsString()
  @Length(1, 1024)
  titleVi: string;

  @ApiProperty({ description: 'Traditional Chinese (zh-TW) title' })
  @IsString()
  @Length(1, 1024)
  titleZhTw: string;

  @ApiProperty({ description: 'English title' })
  @IsString()
  @Length(1, 1024)
  titleEn: string;

  @ApiProperty({ description: 'Vietnamese summary (from RSS description)' })
  @IsString()
  @Length(1, 20000)
  summaryVi: string;

  @ApiProperty({ description: 'Traditional Chinese (zh-TW) summary' })
  @IsString()
  @Length(1, 20000)
  summaryZhTw: string;

  @ApiProperty({ description: 'English summary' })
  @IsString()
  @Length(1, 20000)
  summaryEn: string;
}
