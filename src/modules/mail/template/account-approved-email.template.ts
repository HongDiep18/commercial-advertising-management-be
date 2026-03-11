import type { EmailTemplate } from './email-template.types';

const accountApprovedEmailTemplate: EmailTemplate = {
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
};

export default accountApprovedEmailTemplate;

