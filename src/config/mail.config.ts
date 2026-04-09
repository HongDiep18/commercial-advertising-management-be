import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  setPasswordTokenExpiryDays: 7,
  importSendSetPasswordEmails:
    process.env.IMPORT_SEND_SET_PASSWORD_EMAILS === 'true',
  resetPasswordTokenExpiryHours:
    parseInt(process.env.RESET_PASSWORD_TOKEN_EXPIRY_HOURS ?? '24', 10) || 24,
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM ?? 'noreply@example.com',
  },
}));
