import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

import { PrismaService } from '../../database/prisma.service';
import { FileGeneratingService } from '../file-generating/file-generating.service';
import type { OrderInvoiceData } from '../file-generating/types/order-invoice-data.types';
import accountApprovedEmailTemplate from './template/account-approved-email.template';
import accountRejectedEmailTemplate from './template/account-rejected-email.template';
import adOrderApprovedEmailTemplate from './template/ad-order-approved-email.template';
import adOrderRejectedEmailTemplate from './template/ad-order-rejected-email.template';
import forgotPasswordEmailTemplate from './template/forgot-password-email.template';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;
  private frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly fileGeneratingService: FileGeneratingService,
  ) {
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

  private static readonly CONTACT_TYPE = {
    EMAIL: 'email',
    PHONE: 'phone',
    ADDRESS: 'address',
    TAX_ID: 'tax_id',
    WEBSITE: 'website',
    CONTACT_PHONE: 'contact_phone',
    FAX: 'fax',
    SKYPE: 'skype',
  } as const;

  private getCompanyContactValue(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName?: string | null;
    }>,
    type: string,
  ): string | null {
    const found = contacts.find((contact) => contact.type === type);
    return found?.value ?? null;
  }

  private getContactNameFromContacts(
    contacts: ReadonlyArray<{
      type: string;
      value: string;
      contactName: string | null;
    }>,
  ): string {
    const priorityTypes = [
      MailService.CONTACT_TYPE.EMAIL,
      MailService.CONTACT_TYPE.PHONE,
      MailService.CONTACT_TYPE.CONTACT_PHONE,
    ];
    for (const contactType of priorityTypes) {
      const row = contacts.find(
        (contact) =>
          contact.type === contactType &&
          contact.contactName &&
          contact.contactName.trim().length > 0,
      );
      if (row?.contactName) {
        return row.contactName.trim();
      }
    }
    const anyNamed = contacts.find(
      (contact) =>
        contact.contactName &&
        contact.contactName.trim().length > 0,
    );
    return anyNamed?.contactName?.trim() ?? '';
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
      accountApprovedEmailTemplate.subject,
      accountApprovedEmailTemplate.textBody,
      accountApprovedEmailTemplate.htmlBody,
    );
    console.log(`[Mail] Approval email sent to ${to}`);
  }

  async sendForgotPasswordEmail(to: string, token: string): Promise<void> {
    await this.sendPasswordLinkEmail(
      to,
      token,
      forgotPasswordEmailTemplate.subject,
      forgotPasswordEmailTemplate.textBody,
      forgotPasswordEmailTemplate.htmlBody,
    );
    console.log(`[Mail] Forgot-password email sent to ${to}`);
  }

  async sendAccountRejectedEmail(to: string, reason?: string): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject: accountRejectedEmailTemplate.subject,
          text: accountRejectedEmailTemplate.textBody(reason ?? ''),
          html: accountRejectedEmailTemplate.htmlBody(reason),
        });
        console.log(`[Mail] Rejection email sent to ${to}`);
        return;
      }
      console.log(`[Mail] SMTP not configured – rejection notice for ${to}`);
    } catch (err) {
      console.error('[Mail] sendAccountRejectedEmail failed:', err);
    }
  }

  async sendAdOrderDecisionEmail(
    orderId: string,
    isApproved: boolean,
    reason?: string,
  ): Promise<void> {
    try {
      const order = await this.prisma.adOrder.findUnique({
        where: { id: orderId },
        include: {
          user: {
            select: {
              email: true,
            },
          },
          company: {
            select: {
              companyNameVi: true,
              companyNameZh: true,
              companyContacts: {
                select: {
                  type: true,
                  value: true,
                  contactName: true,
                },
              },
            },
          },
          items: {
            include: {
              pricing: {
                include: {
                  package: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!order) {
        console.log(
          `[Mail] Ad order ${orderId} not found – skipping notification email`,
        );
        return;
      }
      if (!order.company) {
        console.log(
          `[Mail] Ad order ${orderId} has no company – skipping notification email`,
        );
        return;
      }
      const companyEmail = this.getCompanyContactValue(
        order.company.companyContacts,
        MailService.CONTACT_TYPE.EMAIL,
      )?.trim();
      if (!companyEmail) {
        console.log(
          `[Mail] Company email missing for order ${orderId} – skipping notification email`,
        );
        return;
      }
      const invoiceData: OrderInvoiceData = {
        id: order.id,
        status: order.status,
        subtotal: order.subtotal,
        notes: order.notes,
        submittedAt: order.submittedAt,
        createdAt: order.createdAt,
        user: { email: order.user.email },
        company: {
          companyNameVi: order.company.companyNameVi,
          companyNameZh: order.company.companyNameZh,
          email:
            this.getCompanyContactValue(
              order.company.companyContacts,
              MailService.CONTACT_TYPE.EMAIL,
            ) ?? '',
          contactName: this.getContactNameFromContacts(
            order.company.companyContacts,
          ),
          phone:
            this.getCompanyContactValue(
              order.company.companyContacts,
              MailService.CONTACT_TYPE.PHONE,
            ) ?? '',
          address:
            this.getCompanyContactValue(
              order.company.companyContacts,
              MailService.CONTACT_TYPE.ADDRESS,
            ) ?? '',
          taxId: this.getCompanyContactValue(
            order.company.companyContacts,
            MailService.CONTACT_TYPE.TAX_ID,
          ),
        },
        items: order.items.map((item) => ({
          id: item.id,
          startDate: item.startDate,
          designServiceRequired: item.designServiceRequired,
          adLinkUrl: item.adLinkUrl,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
          pricing: {
            durationValue: item.pricing.durationValue,
            durationUnit: item.pricing.durationUnit,
            package: { name: item.pricing.package.name },
          },
        })),
      };
      const itemsTableHtml = this.buildOrderItemsTableHtml(invoiceData);
      const attachment = await this.buildInvoiceAttachment(invoiceData);
      if (isApproved) {
        await this.sendAdOrderApprovedEmail(
          companyEmail,
          orderId,
          attachment,
          itemsTableHtml,
        );
        return;
      }
      await this.sendAdOrderRejectedEmail(
        companyEmail,
        orderId,
        reason,
        itemsTableHtml,
      );
    } catch (err) {
      console.error('[Mail] sendAdOrderDecisionEmail failed:', err);
    }
  }

  async sendAdOrderApprovedEmail(
    to: string,
    orderId: string,
    attachment?: { filename: string; content: Buffer } | null,
    itemsTableHtml?: string,
  ): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject: adOrderApprovedEmailTemplate.subject,
          text: adOrderApprovedEmailTemplate.textBody(orderId),
          html: adOrderApprovedEmailTemplate.htmlBody(orderId, itemsTableHtml),
          attachments: attachment ? [attachment] : undefined,
        });
        console.log(`[Mail] Ad order approval email sent to ${to}`);
        return;
      }
      console.log(
        `[Mail] SMTP not configured – ad order approval notice for ${to} (${orderId})`,
      );
    } catch (err) {
      console.error('[Mail] sendAdOrderApprovedEmail failed:', err);
    }
  }

  async sendAdOrderRejectedEmail(
    to: string,
    orderId: string,
    reason?: string,
    itemsTableHtml?: string,
  ): Promise<void> {
    try {
      if (this.transporter) {
        await this.transporter.sendMail({
          from: this.from,
          to,
          subject: adOrderRejectedEmailTemplate.subject,
          text: adOrderRejectedEmailTemplate.textBody(orderId, reason ?? ''),
          html: adOrderRejectedEmailTemplate.htmlBody(
            orderId,
            reason,
            itemsTableHtml,
          ),
        });
        console.log(`[Mail] Ad order rejection email sent to ${to}`);
        return;
      }
      console.log(
        `[Mail] SMTP not configured – ad order rejection notice for ${to} (${orderId})`,
      );
    } catch (err) {
      console.error('[Mail] sendAdOrderRejectedEmail failed:', err);
    }
  }

  // Uses a broad input type to avoid tight coupling to Prisma payloads
  // while still mapping into the strongly-typed OrderInvoiceData.
  private buildOrderItemsTableHtml(order: OrderInvoiceData): string {
    const formatDate = (d: Date): string =>
      d.toLocaleDateString('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    const formatCurrency = (amount: bigint): string =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(amount));
    const header = `
      <table style="width:100%; border-collapse: collapse; margin-top:16px;">
        <thead>
          <tr>
            <th style="border-bottom:1px solid #ddd; text-align:left; padding:4px 8px;">Item</th>
            <th style="border-bottom:1px solid #ddd; text-align:left; padding:4px 8px;">Duration</th>
            <th style="border-bottom:1px solid #ddd; text-align:left; padding:4px 8px;">Start Date</th>
            <th style="border-bottom:1px solid #ddd; text-align:right; padding:4px 8px;">Qty</th>
            <th style="border-bottom:1px solid #ddd; text-align:right; padding:4px 8px;">Unit Price</th>
            <th style="border-bottom:1px solid #ddd; text-align:right; padding:4px 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
    `;
    const rows = order.items
      .map((item) => {
        const pricingName = `${item.pricing.durationValue ?? 'N/A'} ${
          item.pricing.durationUnit ?? ''
        }`.trim();
        const designNote = item.designServiceRequired ? ' (+ design)' : '';
        return `
          <tr>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px;">
              ${item.pricing.package.name}${designNote}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px;">
              ${pricingName}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px;">
              ${formatDate(item.startDate)}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px; text-align:right;">
              ${item.quantity}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px; text-align:right;">
              ${formatCurrency(item.unitPrice)}
            </td>
            <td style="border-bottom:1px solid #f0f0f0; padding:4px 8px; text-align:right;">
              ${formatCurrency(item.lineTotal)}
            </td>
          </tr>
        `;
      })
      .join('');
    const footer = `
        </tbody>
      </table>
    `;
    return header + rows + footer;
  }

  private async buildInvoiceAttachment(
    order: OrderInvoiceData,
  ): Promise<{ filename: string; content: Buffer }> {
    const stream = this.fileGeneratingService.generateOrderInvoicePdf(order);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);
    return {
      filename: `invoice-${order.id}.pdf`,
      content: buffer,
    };
  }
}
