import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { CONTACT_TYPE } from '../company-contact.constants';

function parseStringArrayValue(value: unknown): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim());
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim());
      }
    } catch {
      return trimmed
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }
  return undefined;
}

function parseContactsValue(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new BadRequestException(
        'contacts must be a valid JSON array when sent as a string',
      );
    }
  }
  return value;
}

const CONTACT_TYPE_VALUES = Object.values(CONTACT_TYPE);

export class AdminCompanyContactDto {
  @ApiProperty({
    enum: CONTACT_TYPE_VALUES,
    example: CONTACT_TYPE.EMAIL,
  })
  @IsString()
  @IsIn(CONTACT_TYPE_VALUES)
  type!: string;

  @ApiProperty({
    example: 'sales@example.com',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  value!: string;

  @ApiPropertyOptional({
    example: 'Nguyen Van A',
    description: 'Optional display/grouping name for this contact row',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string | null;
}

export class AdminUpdateCompanyDto {
  @ApiPropertyOptional({
    description:
      'Logo URL. For multipart requests, uploading `logo_url` file will override this value.',
    example: 'https://cdn.example.com/company-logos/acme.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyNameVi?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyNameEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyNameZh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  region?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['textile', 'tourism'],
    description:
      'Accepts an array in JSON requests, or a JSON-stringified array / comma-separated string in multipart requests.',
  })
  @IsOptional()
  @Transform(({ value }) => parseStringArrayValue(value))
  @IsArray()
  @IsString({ each: true })
  industry?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({
    description:
      'Free-form note stored as a company_contact row with type `note`. Omit to leave unchanged; send null or an empty string to remove the note.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(4000)
  note?: string | null;

  @ApiPropertyOptional({
    type: [AdminCompanyContactDto],
    description:
      'Replaces all company contact rows when provided. Accepts an array in JSON requests, or a JSON-stringified array in multipart requests.',
  })
  @IsOptional()
  @Transform(({ value }) => parseContactsValue(value))
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminCompanyContactDto)
  contacts?: AdminCompanyContactDto[];
}
