import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  logoUrl!: string | null;

  @ApiPropertyOptional()
  companyNameVi!: string | null;

  @ApiPropertyOptional()
  companyNameCn!: string | null;

  @ApiProperty()
  industry!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  taxId!: string | null;

  @ApiPropertyOptional()
  region!: string | null;

  @ApiPropertyOptional()
  website!: string | null;

  @ApiPropertyOptional()
  contactName!: string | null;
}
