import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/**
 * Progressive block durations for repeated identical messages (in ms):
 * 1st violation → 5 min, 2nd → 30 min, 3rd+ → 2 hours
 */
const BLOCK_DURATIONS_MS = [5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

/** How many consecutive identical messages trigger a block */
const CONSECUTIVE_THRESHOLD = 3;

/** Entries not seen for longer than this are evicted (ms). Matches max block duration. */
const EVICT_AFTER_MS = 2 * 60 * 60_000; // 2 hours

/** How often the cleanup sweep runs (ms). */
const CLEANUP_INTERVAL_MS = 10 * 60_000; // 10 minutes

interface IdentityState {
  lastMessage: string;
  consecutiveCount: number;
  blockedUntil: number;
  violations: number;
  lastSeen: number;
}

@Injectable()
export class SpamDetectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SpamDetectorService.name);
  private readonly state = new Map<string, IdentityState>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.evictStale(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  private evictStale() {
    const cutoff = Date.now() - EVICT_AFTER_MS;
    let evicted = 0;
    for (const [key, entry] of this.state) {
      if (entry.lastSeen < cutoff && entry.blockedUntil < Date.now()) {
        this.state.delete(key);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.debug(`[spam] evicted ${evicted} stale entries (${this.state.size} remaining)`);
    }
  }

  /**
   * Returns null if the message is allowed, or { retryAfterMs } if blocked.
   */
  check(identity: string, message: string): { retryAfterMs: number } | null {
    const now = Date.now();
    const entry = this.state.get(identity) ?? {
      lastMessage: '',
      consecutiveCount: 0,
      blockedUntil: 0,
      violations: 0,
      lastSeen: now,
    };

    // Already blocked
    if (entry.blockedUntil > now) {
      entry.lastSeen = now;
      this.state.set(identity, entry);
      return { retryAfterMs: entry.blockedUntil - now };
    }

    const normalized = message.trim().toLowerCase();

    if (normalized === entry.lastMessage) {
      entry.consecutiveCount += 1;
    } else {
      // Different message — reset streak
      entry.lastMessage = normalized;
      entry.consecutiveCount = 1;
    }

    entry.lastSeen = now;

    if (entry.consecutiveCount >= CONSECUTIVE_THRESHOLD) {
      const durationMs =
        BLOCK_DURATIONS_MS[Math.min(entry.violations, BLOCK_DURATIONS_MS.length - 1)];
      entry.blockedUntil = now + durationMs;
      entry.violations += 1;
      entry.consecutiveCount = 0;
      this.state.set(identity, entry);

      this.logger.warn(
        `[spam] identity=${identity} blocked for ${durationMs / 60_000}min (violation #${entry.violations})`,
      );
      return { retryAfterMs: durationMs };
    }

    this.state.set(identity, entry);
    return null;
  }
}
