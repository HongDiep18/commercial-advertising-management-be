import type { EmailTemplate } from './email-template.types';

const adOrderRejectedEmailTemplate: EmailTemplate = {
  subject: 'Your VN Buyer Guide ad order has been rejected',
  textBody: (orderId: string, reason?: string) =>
    `Hello,\n\nYour advertising order (${orderId}) has been rejected.\n\n${
      reason ? `Reason: ${reason}\n\n` : ''
    }If you have questions, please contact our support team.\n\nBest regards,\nVN Buyer Guide Team`,
  htmlBody: (orderId: string, reason?: string, itemsTableHtml?: string) => `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #d9534f;">Ad order rejected</h2>
          <p>Hello,</p>
          <p>Your advertising order (<strong>${orderId}</strong>) has been <strong>rejected</strong>.</p>
          ${
            reason
              ? `<div style="background-color: #fff5f5; border-left: 4px solid #d9534f; padding: 12px; margin: 16px 0;">
                   <p style="margin: 0; font-weight: bold; color: #d9534f;">Reason</p>
                   <p style="margin: 6px 0 0 0; color: #555;">${reason}</p>
                 </div>`
              : ''
          }
          <p>If you have questions, please contact our support team.</p>
          ${itemsTableHtml ?? ''}
          <p style="margin-top: 30px;">Best regards,<br><strong>VN Buyer Guide Team</strong></p>
        </div>
      </body>
    </html>
  `,
};

export default adOrderRejectedEmailTemplate;

