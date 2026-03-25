import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  ValidateNested,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

function IsNotPastDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotPastDate',
      target: (object as { constructor: Function }).constructor,
      propertyName,
      options: {
        message: 'startDate must not be in the past',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          return new Date(value) >= today;
        },
      },
    });
  };
}

export class CreateAdOrderItemDto {
  @ApiProperty({
    description:
      'Selected pricing option identifier (implicitly defines the ad package)',
    format: 'uuid',
  })
  @IsString()
  pricingId!: string;

  @ApiProperty({
    description:
      'Whether design service is required for this order item (e.g. banner/popup creative production)',
    default: false,
  })
  @IsBoolean()
  designServiceRequired!: boolean;

  @ApiProperty({
    description: 'Destination URL for the ad click-through',
    example: 'https://www.example.com/landing-page',
  })
  @IsString()
  adLinkUrl!: string;

  @ApiProperty({
    description: 'Ad start date (ISO 8601)',
    example: '2026-03-10',
  })
  @IsDateString()
  @IsNotPastDate()
  startDate!: string;
}

export class CreateAdOrderDto {
  @ApiPropertyOptional({
    description: 'Additional notes from the customer about this order',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'List of ad items included in this order',
    type: [CreateAdOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAdOrderItemDto)
  items!: CreateAdOrderItemDto[];
}
