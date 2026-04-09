/**
 * Data required to generate an order invoice PDF.
 * Keeps the file-generating module decoupled from domain entities.
 */
export type OrderInvoiceCompanyData = {
  companyNameVi: string | null;
  companyNameZh: string | null;
  email: string;
  contactName: string;
  phone: string;
  address: string;
  taxId: string | null;
};

export type OrderInvoiceItemData = {
  id: string;
  startDate: Date;
  designServiceRequired: boolean;
  adLinkUrl: string;
  unitPrice: bigint;
  quantity: number;
  lineTotal: bigint;
  pricing: {
    durationValue: number | null;
    durationUnit: string | null;
    package: { name: string };
  };
};

export type OrderInvoiceData = {
  id: string;
  status: string;
  subtotal: bigint;
  notes: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  user: { email: string };
  company: OrderInvoiceCompanyData;
  items: OrderInvoiceItemData[];
};

