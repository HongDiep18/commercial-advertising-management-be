import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';

type CaptchaChallenge = {
  readonly text: string;
  readonly expiresAtMs: number;
};

@Injectable()
export class CaptchaVerificationService {
  private static readonly CAPTCHA_LENGTH = 5;
  private static readonly CAPTCHA_TTL_MS = 2 * 60 * 1000;
  private static readonly SVG_WIDTH = 150;
  private static readonly SVG_HEIGHT = 50;
  private readonly challenges = new Map<string, CaptchaChallenge>();

  createChallenge(): {
    captchaId: string;
    captchaSvg: string;
    expiresInMs: number;
  } {
    this.removeExpiredChallenges();
    const captchaId = randomBytes(16).toString('hex');
    const plainText = this.generateCaptchaText();
    const captchaSvg = this.buildCaptchaSvg(plainText);
    const answer = plainText.toUpperCase();
    const expiresAtMs = Date.now() + CaptchaVerificationService.CAPTCHA_TTL_MS;
    this.challenges.set(captchaId, { text: answer, expiresAtMs });
    return {
      captchaId,
      captchaSvg,
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

  private buildCaptchaSvg(plainText: string): string {
    const w = CaptchaVerificationService.SVG_WIDTH;
    const h = CaptchaVerificationService.SVG_HEIGHT;
    const chars = [...plainText];
    let noise = '';
    for (let i = 0; i < 4; i += 1) {
      const x1 = randomInt(0, w);
      const y1 = randomInt(0, h);
      const x2 = randomInt(0, w);
      const y2 = randomInt(0, h);
      noise += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgb(${randomInt(100, 200)},${randomInt(100, 200)},${randomInt(100, 200)})" stroke-width="1"/>`;
    }
    const step = w / (chars.length + 1);
    let textEls = '';
    chars.forEach((ch, i) => {
      const x = step * (i + 1) + randomInt(-4, 4);
      const y = h / 2 + randomInt(-6, 6);
      const rot = randomInt(-22, 22);
      const fill = `rgb(${randomInt(30, 120)},${randomInt(30, 120)},${randomInt(30, 120)})`;
      const safe = CaptchaVerificationService.escapeXml(ch);
      textEls += `<text x="${x}" y="${y}" fill="${fill}" font-size="22" font-family="Arial,sans-serif" dominant-baseline="middle" text-anchor="middle" transform="rotate(${rot} ${x} ${h / 2})">${safe}</text>`;
    });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f2f2f2"/>${noise}${textEls}</svg>`;
  }

  private static escapeXml(ch: string): string {
    if (ch.length !== 1) {
      return '';
    }
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&apos;',
    };
    return map[ch] ?? ch;
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

  private removeExpiredChallenges(): void {
    const nowMs = Date.now();
    for (const [id, challenge] of this.challenges.entries()) {
      if (challenge.expiresAtMs <= nowMs) {
        this.challenges.delete(id);
      }
    }
  }
}
