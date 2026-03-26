import { ApiProperty } from '@nestjs/swagger';

export class AdminCompanyStatsResponseDto {
  @ApiProperty({
    example: 12,
    description: 'Total rows in company_profile_requests with status APPROVED.',
  })
  approvedCount!: number;
}
