import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class SessionQueryDto {
  @ApiPropertyOptional({ description: 'Guest session UUID from localStorage' })
  @IsOptional()
  @IsUUID()
  guestId?: string;
}
