import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

const AUTH_THROTTLE = { default: { limit: 4, ttl: 60_000 } };
const CHAT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

export const ThrottleAuth = () =>
  applyDecorators(UseGuards(ThrottlerGuard), Throttle(AUTH_THROTTLE));

export const ThrottleChat = () =>
  applyDecorators(UseGuards(ThrottlerGuard), Throttle(CHAT_THROTTLE));
