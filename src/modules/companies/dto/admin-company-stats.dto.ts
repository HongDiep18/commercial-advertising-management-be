import { ApiProperty } from '@nestjs/swagger';

export class AdminCompanyStatsResponseDto {
  @ApiProperty({
    example: 98,
    description: 'Number of companies with `is_active = true`.',
  })
  activeCount!: number;
}
