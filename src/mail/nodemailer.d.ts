declare module 'nodemailer' {
  export type TransportOptions = {
    host?: string;
    port?: number;
    secure?: boolean;
    auth?: { user: string; pass: string };
  };
  export type Transporter = {
    sendMail(options: {
      from: string;
      to: string;
      subject: string;
      html?: string;
      text?: string;
    }): Promise<unknown>;
  };
  export function createTransport(options?: TransportOptions): Transporter;
}
