import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';

/**
 * Throttles by userId (authenticated) or guestId (body) instead of IP.
 * Behind Docker/nginx all requests share the same IP, so IP-based throttling
 * is ineffective — this ensures limits are enforced per identity.
 * Falls back to IP if neither identity is present.
 */
@Injectable()
export class ChatThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    const user = (req as any).user as { userId?: string } | undefined;
    if (user?.userId) return `user:${user.userId}`;

    const guestId = req.body?.guestId as string | undefined;
    if (guestId) return `guest:${guestId}`;

    return req.ip ?? 'unknown';
  }
}
