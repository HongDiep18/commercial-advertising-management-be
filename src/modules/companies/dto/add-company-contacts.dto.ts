import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Request body for appending additional company contact rows (email, contact phone).
 * Optional `contactName` is stored on each new row (DB column `contact_name`).
 * Duplicates (same company + type + normalized value) are skipped.
 */
export class AddCompanyContactsDto {
  @ApiProperty({
    required: false,
    type: [String],
    description: 'Email addresses to add as separate contact rows',
    example: ['sales@example.com', 'info@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  @MaxLength(255, { each: true })
  emails?: string[];

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Contact phone numbers to add as separate contact rows',
    example: ['+84 28 1234 5678', '+84 90 123 4567'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(50, { each: true })
  contactPhones?: string[];

  @ApiProperty({
    required: false,
    description:
      'Contact person name stored on each created row (column `contact_name`)',
    example: 'Jane Nguyen',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactName?: string;
}
