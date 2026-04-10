import { ApiProperty } from '@nestjs/swagger';
import { CompanyProfileRequestStatus } from '@prisma/client';

export class AdminArchiveCompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CompanyProfileRequestStatus })
  status!: CompanyProfileRequestStatus;
}
