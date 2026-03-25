import { ApiProperty } from '@nestjs/swagger';

export class CompanyDirectoryStatsResponseDto {
  @ApiProperty({
    example: 100,
    description: 'All company rows in the database.',
  })
  total!: number;

  @ApiProperty({
    example: 42,
    description:
      'Companies shown in the directory: approved profile request, company email matches ' +
      'that request, and at least one active user (not disabled, not soft-deleted).',
  })
  directoryCount!: number;
}
