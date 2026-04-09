import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import unidecode from 'unidecode';
import type { OrderInvoiceData } from './types/order-invoice-data.types';

@Injectable()
export class FileGeneratingService {
  /**
   * Generate an order invoice PDF as a readable stream.
   * Uses built-in Helvetica font (no font switching).
   */
  generateOrderInvoicePdf(order: OrderInvoiceData): Readable {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = new Readable();
    stream._read = () => {};
    doc.on('data', (chunk: Buffer) => stream.push(chunk));
    doc.on('end', () => stream.push(null));

    doc.font('Helvetica');

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

    doc.fontSize(20).text('Order Invoice', { align: 'center' });
    doc.moveDown();

    doc.fontSize(10);
    doc.text(`Order ID: ${order.id}`);
    doc.text(`Status: ${order.status}`);
    doc.text(`Created: ${formatDate(order.createdAt)}`);
    if (order.submittedAt) {
      doc.text(`Submitted: ${formatDate(order.submittedAt)}`);
    }
    doc.moveDown();

    const company = order.company;
    const companyName = unidecode(
      company.companyNameVi ?? company.companyNameZh ?? 'N/A',
    );
    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(10);
    doc.text(companyName);
    doc.text(`Contact: ${unidecode(company.contactName)}`);
    doc.text(`Email: ${company.email}`);
    doc.text(`Phone: ${company.phone}`);
    if (company.address) {
      doc.text(`Address: ${unidecode(company.address)}`);
    }
    if (company.taxId) {
      doc.text(`Tax ID: ${unidecode(company.taxId)}`);
    }
    doc.moveDown();

    doc.fontSize(12).text('Order Items', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    const col1 = 50;
    const col2 = 250;
    const col3 = 320;
    const col4 = 380;
    const col5 = 450;
    const col6 = 520;

    doc.fontSize(9);
    doc.text('Item', col1, tableTop);
    doc.text('Duration', col2, tableTop);
    doc.text('Start Date', col3, tableTop);
    doc.text('Qty', col4, tableTop);
    doc.text('Unit Price', col5, tableTop);
    doc.text('Total', col6, tableTop);
    doc
      .strokeColor('black')
      .moveTo(50, tableTop + 15)
      .lineTo(560, tableTop + 15)
      .stroke();
    doc.moveDown();

    doc.fontSize(9);
    let y = tableTop + 25;
    for (const item of order.items) {
      const pricingName =
        `${item.pricing.durationValue ?? 'N/A'} ${item.pricing.durationUnit ?? ''}`.trim();
      const designNote = item.designServiceRequired ? ' (+ design)' : '';
      doc.text(
        `${unidecode(item.pricing.package.name)}${designNote}`,
        col1,
        y,
        {
          width: 190,
        },
      );
      doc.text(pricingName, col2, y, { width: 65 });
      doc.text(formatDate(item.startDate), col3, y, { width: 55 });
      doc.text(String(item.quantity), col4, y, { width: 65 });
      doc.text(formatCurrency(item.unitPrice), col5, y, { width: 65 });
      doc.text(formatCurrency(item.lineTotal), col6, y, { width: 65 });
      y += 20;
    }

    doc.moveDown(2);
    doc
      .fontSize(10)
      .text(`Subtotal: ${formatCurrency(order.subtotal)}`, 400, doc.y, {
        align: 'right',
      });

    if (order.notes) {
      doc.moveDown(2);
      doc.fontSize(9);
      doc.text('Notes:', { underline: true });
      doc.text(unidecode(order.notes), { width: 500 });
    }

    doc.end();
    return stream;
  }
}

