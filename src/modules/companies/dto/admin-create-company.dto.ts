import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminCreateCompanyDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_vi!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_en?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_zh!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message:
      'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
  phone!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tax_id!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contact_person!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  company_address!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  register_email!: string;

  @ApiProperty()
  @IsEmail()
  @MaxLength(255)
  company_email!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  region?: string;

  @ApiProperty({ type: [String] })
  @IsNotEmpty()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  industry!: string[];

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(/^https?:\/\/[^\s]+$/, {
    message: 'Website must be a valid HTTP or HTTPS URL',
  })
  website!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message:
      'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
  fax?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  skype?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  introduction!: string;
}

export class AdminCreateCompanyResponseDto {
  @ApiProperty({ format: 'uuid' })
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ example: 'MEMBER' })
  role!: string;

  @ApiProperty({ example: 'APPROVED' })
  companyStatus!: string;

  @ApiProperty()
  setPasswordEmailSent!: boolean;
}
