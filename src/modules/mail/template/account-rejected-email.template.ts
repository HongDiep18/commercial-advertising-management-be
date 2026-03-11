import type { EmailTemplate } from './email-template.types';

const accountRejectedEmailTemplate: EmailTemplate = {
  subject: 'Update regarding your VN Buyer Guide Application',
  textBody: (reason?: string) =>
    `Hello,\n\nThank you for your interest in VN Buyer Guide. After reviewing your registration request, we regret to inform you that your application has not been approved at this time.\n\n${
      reason ? `Reason for rejection: ${reason}\n\n` : ''
    }If you believe this is a mistake or have further questions, please contact our support team.\n\nBest regards,\nThe VN Buyer Guide Team`,
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
};

export default accountRejectedEmailTemplate;

