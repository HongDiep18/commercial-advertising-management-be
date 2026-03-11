import type { EmailTemplate } from './email-template.types';

const adOrderApprovedEmailTemplate: EmailTemplate = {
  subject: 'Your VN Buyer Guide ad order has been approved',
  textBody: (orderId: string) =>
    `Hello,\n\nYour advertising order (${orderId}) has been approved and will be activated according to the selected schedule.\n\nBest regards,\nVN Buyer Guide Team`,
  htmlBody: (orderId: string, itemsTableHtml?: string) => `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
          <h2 style="color: #2c3e50;">Ad order approved</h2>
          <p>Hello,</p>
          <p>Your advertising order (<strong>${orderId}</strong>) has been <strong>approved</strong>.</p>
          <p>We will activate it according to the selected schedule.</p>
          ${itemsTableHtml ?? ''}
          <p style="margin-top: 30px;">Best regards,<br><strong>VN Buyer Guide Team</strong></p>
        </div>
      </body>
    </html>
  `,
};

export default adOrderApprovedEmailTemplate;

