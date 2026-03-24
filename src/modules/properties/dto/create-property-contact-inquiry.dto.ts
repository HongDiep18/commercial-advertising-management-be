import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Represents the payload used to create a property contact inquiry.
 */
export class CreatePropertyContactInquiryDto {
  @ApiProperty({ example: 'Nguyen Van A' })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ example: 'buyer@example.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiPropertyOptional({
    example: 'I am interested in this property. Please contact me.',
  })
  @IsOptional()
  @IsString()
  message?: string;
}