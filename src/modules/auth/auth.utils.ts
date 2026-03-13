import { UnauthorizedException } from '@nestjs/common';
import { AUTH_ERROR_MESSAGES } from './auth.constants';

export function assertUserActive(
  user: { isActive: boolean; deletedAt?: Date | null } | null,
): asserts user is { isActive: true; deletedAt: null } {
  if (!user || !user.isActive || user.deletedAt != null) {
    throw new UnauthorizedException(AUTH_ERROR_MESSAGES.ACCOUNT_DISABLED);
  }
}
