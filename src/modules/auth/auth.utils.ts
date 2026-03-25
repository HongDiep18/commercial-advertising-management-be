import { UnauthorizedException } from '@nestjs/common';
import { AUTH_ERROR_MESSAGES } from './auth.constants';

export function assertUserActive<T extends { isActive: boolean; deletedAt?: Date | null }>(
  user: T | null,
): asserts user is T & { isActive: true; deletedAt: null } {
  if (!user || !user.isActive || user.deletedAt != null) {
    throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED);
  }
}
