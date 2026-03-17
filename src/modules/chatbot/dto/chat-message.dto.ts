import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ example: 'How do I register?', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @ApiPropertyOptional({ description: 'Guest session UUID from localStorage' })
  @IsOptional()
  @IsUUID()
  guestId?: string;
}
