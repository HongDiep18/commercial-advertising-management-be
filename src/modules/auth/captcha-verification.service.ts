import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

type CaptchaChallenge = {
  readonly text: string;
  readonly expiresAtMs: number;
};

@Injectable()
export class CaptchaVerificationService {
  private static readonly CAPTCHA_LENGTH = 5;
  private static readonly CAPTCHA_TTL_MS = 2 * 60 * 1000;
  private readonly challenges = new Map<string, CaptchaChallenge>();

  createChallenge(): {
    captchaId: string;
    captchaText: string;
    expiresInMs: number;
  } {
    this.removeExpiredChallenges();
    const captchaId = randomBytes(16).toString('hex');
    const captchaText = this.generateCaptchaText();
    const expiresAtMs = Date.now() + CaptchaVerificationService.CAPTCHA_TTL_MS;
    this.challenges.set(captchaId, { text: captchaText, expiresAtMs });
    return {
      captchaId,
      captchaText,
      expiresInMs: CaptchaVerificationService.CAPTCHA_TTL_MS,
    };
  }

  verifyAndConsumeChallenge(captchaId: string, captchaInput: string): void {
    const normalizedCaptchaId = captchaId.trim();
    const normalizedCaptchaInput = captchaInput.trim().toUpperCase();
    if (
      normalizedCaptchaId.length === 0 ||
      normalizedCaptchaInput.length === 0
    ) {
      throw new BadRequestException('Captcha is required.');
    }
    const challenge = this.challenges.get(normalizedCaptchaId);
    if (!challenge) {
      throw new BadRequestException('Captcha invalid or expired.');
    }
    if (Date.now() > challenge.expiresAtMs) {
      this.challenges.delete(normalizedCaptchaId);
      throw new BadRequestException('Captcha invalid or expired.');
    }
    this.challenges.delete(normalizedCaptchaId);
    if (challenge.text !== normalizedCaptchaInput) {
      throw new BadRequestException('Captcha invalid or expired.');
    }
  }

  private removeExpiredChallenges(): void {
    const nowMs = Date.now();
    for (const [captchaId, challenge] of this.challenges.entries()) {
      if (challenge.expiresAtMs <= nowMs) {
        this.challenges.delete(captchaId);
      }
    }
  }

  private generateCaptchaText(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(CaptchaVerificationService.CAPTCHA_LENGTH);
    const chars = Array.from(bytes).map((value) => {
      const idx = value % alphabet.length;
      return alphabet[idx];
    });
    return chars.join('');
  }
}
