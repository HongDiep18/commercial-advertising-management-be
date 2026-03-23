import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_vi: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  company_name_cn: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message: 'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
  phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tax_id: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  contact_person: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[+\d\s()-]+$/, {
    message: 'Phone must contain only numbers, spaces, and phone symbols (+, -, (), spaces)',
  })
  contact_phone: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  company_address: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  country: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  region?: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  industry: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  @Matches(/^https?:\/\/[^\s]+$/, {
    message: 'Website must be a valid HTTP or HTTPS URL',
  })
  website: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  introduction: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  captcha: string;
}
