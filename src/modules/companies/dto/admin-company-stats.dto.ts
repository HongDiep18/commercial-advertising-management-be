import { ApiProperty } from '@nestjs/swagger';

export class AdminCompanyStatsResponseDto {
  @ApiProperty({
    example: 12,
    description:
      'Total companies with registration APPROVED and at least one active user.',
  })
  approvedCount!: number;
}
