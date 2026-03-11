import type { EmailTemplate } from './email-template.types';

const forgotPasswordEmailTemplate: EmailTemplate = {
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
};

export default forgotPasswordEmailTemplate;

