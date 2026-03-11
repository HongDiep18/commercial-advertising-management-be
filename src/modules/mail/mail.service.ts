import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const APPROVED_EMAIL = {
  subject: 'Welcome to VN Buyer Guide – Complete Your Account Setup',

  textBody: (link: string) =>
    `Hello,\n\nCongratulations! Your company registration request for the VN Buyer Guide platform has been approved. \n\nTo access your dashboard, please set your account password by clicking the link below:\n${link}\n\nThis link will expire in 7 days. If you did not request this, please ignore this email.\n\nBest regards,\nVN Buyer Guide Team`,

  htmlBody: (link: string) => `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #2c3e50;">Welcome to VN Buyer Guide</h2>
          <p>Hello,</p>
          <p>We are pleased to inform you that your company registration request has been <strong>approved</strong>.</p>
          <p>To finalize your account and begin using our services, please click the button below to set your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}" 
               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
               Set My Password
            </a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            <em>Note: This secure link will expire in 7 days.</em>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8em; color: #999;">
            If the button above doesn't work, copy and paste this URL into your browser:<br>
            ${link}
          </p>
          <p style="font-size: 0.8em; color: #999;">
            Best regards,<br>
            <strong>The VN Buyer Guide Team</strong>
          </p>
        </div>
      </body>
    </html>
  `,
} as const;

const FORGOT_PASSWORD_EMAIL = {
  subject: 'Reset your VN Buyer Guide password',

  textBody: (link: string) =>
    `Hello,\n\nYou requested a password reset for your VN Buyer Guide account.\n\nTo set a new password, click the link below:\n${link}\n\nThis link will expire in 24 hours. If you did not request this, please ignore this email.\n\nBest regards,\nVN Buyer Guide Team`,

  htmlBody: (link: string) => `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #2c3e50;">Reset your password</h2>
          <p>Hello,</p>
          <p>You requested a password reset for your VN Buyer Guide account.</p>
          <p>Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${link}"
               style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Reset password
            </a>
          </div>
          <p style="font-size: 0.9em; color: #666;">
            <em>This link will expire in 24 hours.</em>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 0.8em; color: #999;">
            If the button doesn't work, copy this URL into your browser:<br>
            ${link}
          </p>
          <p style="font-size: 0.8em; color: #999;">Best regards,<br><strong>VN Buyer Guide Team</strong></p>
        </div>
      </body>
    </html>
  `,
} as const;

const REJECTED_EMAIL = {
  subject: 'Update regarding your VN Buyer Guide Application',

  textBody: (reason?: string) =>
    `Hello,\n\nThank you for your interest in VN Buyer Guide. After reviewing your registration request, we regret to inform you that your application has not been approved at this time.\n\n${reason ? `Reason for rejection: ${reason}\n\n` : ''}If you believe this is a mistake or have further questions, please contact our support team.\n\nBest regards,\nThe VN Buyer Guide Team`,

  htmlBody: (reason?: string) => `
    <!DOCTYPE html>
    <html>
      <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e0e0e0;">
          <div style="background-color: #f8f9fa; padding: 20px; border-bottom: 1px solid #eeeeee;">
            <h2 style="margin: 0; color: #d9534f;">Registration Update</h2>
          </div>
          <div style="padding: 30px;">
            <p>Hello,</p>
            <p>Thank you for your interest in joining the <strong>VN Buyer Guide</strong> community.</p>
            <p>After a careful review of your profile, we regret to inform you that your registration request has <strong>not been approved</strong> at this time.</p>
            
            ${
              reason
                ? `
            <div style="background-color: #fff5f5; border-left: 4px solid #d9534f; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold; color: #d9534f;">Reviewer Feedback:</p>
              <p style="margin: 5px 0 0 0; color: #555;">${reason}</p>
            </div>
            `
                : ''
            }

            <p>If you have any questions or would like to provide additional documentation for a re-evaluation, please do not hesitate to contact our support team.</p>
            
            <p style="margin-top: 30px;">Best regards,<br>
            <strong>The VN Buyer Guide Team</strong></p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #999;">
            © 2026 VN Buyer Guide. All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `,
} as const;

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;
  private frontendUrl: string;

  constructor(private config: ConfigService) {
    this.from =
      this.config.get<string>('mail.smtp.from') ?? 'noreply@example.com';
    this.frontendUrl =
      this.config.get<string>('mail.frontendUrl') ?? 'http://localhost:3000';

    const host = this.config.get<string>('mail.smtp.host');
    const user = this.config.get<string>('mail.smtp.user');
    const pass = this.config.get<string>('mail.smtp.pass');
    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port: this.config.get<number>('mail.smtp.port', 587),
          secure: this.config.get<boolean>('mail.smtp.secure', false),
          auth: { user, pass },
        });
      } catch {
        this.transporter = null;
      }
    }
  }

  buildSetPasswordLink(token: string): string {
    const base = this.frontendUrl.replace(/\/$/, '');
    return `${base}/set-password?token=${encodeURIComponent(token)}`;
  }

  private async sendPasswordLinkEmail(
    to: string,
    token: string,
    subject: string,
    textBody: (link: string) => string,
    htmlBody: (link: string) => string,
  ): Promise<void> {
    const link = this.buildSetPasswordLink(token);
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject,
          text: textBody(link),
          html: htmlBody(link),
        });
        return;
      }
      console.log(`[Mail] No SMTP – link for ${to}: ${link}`);
    } catch (err) {
      console.error('[Mail] send mail failed:', err);
    }
  }

  async sendAccountApprovedEmail(to: string, token: string): Promise<void> {
    await this.sendPasswordLinkEmail(
      to,
      token,
      APPROVED_EMAIL.subject,
      APPROVED_EMAIL.textBody,
      APPROVED_EMAIL.htmlBody,
    );
    console.log(`[Mail] Approval email sent to ${to}`);
  }

  async sendForgotPasswordEmail(to: string, token: string): Promise<void> {
    await this.sendPasswordLinkEmail(
      to,
      token,
      FORGOT_PASSWORD_EMAIL.subject,
      FORGOT_PASSWORD_EMAIL.textBody,
      FORGOT_PASSWORD_EMAIL.htmlBody,
    );
    console.log(`[Mail] Forgot-password email sent to ${to}`);
  }

  async sendAccountRejectedEmail(to: string, reason?: string): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject: REJECTED_EMAIL.subject,
          text: REJECTED_EMAIL.textBody(reason),
          html: REJECTED_EMAIL.htmlBody(reason),
        });
        console.log(`[Mail] Rejection email sent to ${to}`);
        return;
      }
      console.log(`[Mail] SMTP not configured – rejection notice for ${to}`);
    } catch (err) {
      console.error('[Mail] sendAccountRejectedEmail failed:', err);
    }
  }
}
