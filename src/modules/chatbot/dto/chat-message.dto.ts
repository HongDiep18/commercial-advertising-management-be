import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ example: 'How do I register?', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  message: string;

  @ApiPropertyOptional({ description: 'Guest session UUID from localStorage' })
  @IsOptional()
  @IsUUID()
  guestId?: string;
}
