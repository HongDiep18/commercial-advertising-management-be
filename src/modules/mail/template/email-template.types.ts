export type EmailTemplate = {
  readonly subject: string;
  readonly textBody: (...args: readonly (string | undefined)[]) => string;
  readonly htmlBody: (...args: readonly (string | undefined)[]) => string;
};

