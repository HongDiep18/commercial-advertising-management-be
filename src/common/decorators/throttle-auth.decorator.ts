import { applyDecorators, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ChatThrottlerGuard } from '../guards/chat-throttler.guard';

const AUTH_THROTTLE = { default: { limit: 4, ttl: 60_000 } };
const CHAT_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

export const ThrottleAuth = () =>
  applyDecorators(UseGuards(ThrottlerGuard), Throttle(AUTH_THROTTLE));

export const ThrottleChat = () =>
  applyDecorators(UseGuards(ChatThrottlerGuard), Throttle(CHAT_THROTTLE));
