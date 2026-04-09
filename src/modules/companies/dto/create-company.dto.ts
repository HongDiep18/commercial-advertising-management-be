import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCompanyDto {
  @ApiProperty({ description: 'Company name', example: 'VN Buyer Guide Co.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Company contact email',
    example: 'contact@vnbuyerguide.com',
  })
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description: 'Primary contact person name',
    example: 'Jane Nguyen',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  contactName: string;

  @ApiProperty({
    description: 'Company phone number',
    example: '+84 28 1234 5678',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  phone: string;

  @ApiProperty({
    description: 'Company industries',
    example: ['Manufacturing', 'Textile'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @IsNotEmpty()
  industry: string[];

  @ApiProperty({
    description: 'Company address',
    example: '12 Nguyen Hue, District 1, Ho Chi Minh City, Vietnam',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  address: string;

  @ApiProperty({
    description: 'Company description',
    example:
      'We help international buyers find trusted Vietnamese suppliers across key industries.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;
}
