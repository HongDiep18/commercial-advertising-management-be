export const COMPANY_EXPORT_LOCALES = ['vi', 'en', 'zh'] as const;

export type CompanyExportLocale = (typeof COMPANY_EXPORT_LOCALES)[number];

export const COMPANY_EXPORT_TYPES = ['excel', 'csv'] as const;

export type CompanyExportFileType = (typeof COMPANY_EXPORT_TYPES)[number];

export const COMPANY_EXPORT_EXCEL_TYPE = 'excel' as const;

export const COMPANY_EXPORT_CSV_TYPE = 'csv' as const;

export const COMPANY_EXPORT_MIME_BY_TYPE: Record<
  CompanyExportFileType,
  string
> = {
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};

type CompanyNameColumnKey = 'companyNameVi' | 'companyNameEn' | 'companyNameZh';

export type CompanyExportColumnKey =
  | 'id'
  | CompanyNameColumnKey
  | 'industry'
  | 'active'
  | 'allEmails'
  | 'allPhones'
  | 'website'
  | 'address'
  | 'taxId'
  | 'country'
  | 'region'
  | 'updatedAt';

const NAME_COLUMN_ORDER_BY_LOCALE: Record<
  CompanyExportLocale,
  readonly CompanyNameColumnKey[]
> = {
  vi: ['companyNameVi', 'companyNameEn', 'companyNameZh'],
  en: ['companyNameEn', 'companyNameZh', 'companyNameVi'],
  zh: ['companyNameZh', 'companyNameEn', 'companyNameVi'],
};

const FIXED_COLUMNS_BEFORE: readonly CompanyExportColumnKey[] = ['id'];
const FIXED_COLUMNS_AFTER: readonly CompanyExportColumnKey[] = [
  'industry',
  'active',
  'allEmails',
  'allPhones',
  'website',
  'address',
  'taxId',
  'country',
  'region',
  'updatedAt',
];

export function getCompanyExportColumnOrder(
  locale: CompanyExportLocale,
): readonly CompanyExportColumnKey[] {
  return [
    ...FIXED_COLUMNS_BEFORE,
    ...NAME_COLUMN_ORDER_BY_LOCALE[locale],
    ...FIXED_COLUMNS_AFTER,
  ];
}

const EXPORT_HEADERS: Record<
  CompanyExportLocale,
  Record<CompanyExportColumnKey, string>
> = {
  vi: {
    id: 'ID',
    companyNameVi: 'Tên công ty (VI)',
    companyNameEn: 'Tên công ty (EN)',
    companyNameZh: 'Tên công ty (ZH)',
    industry: 'Ngành',
    active: 'Hoạt động',
    allEmails: 'Tất cả email',
    allPhones: 'Tất cả số điện thoại',
    website: 'Trang web',
    address: 'Địa chỉ',
    taxId: 'Mã số thuế',
    country: 'Quốc gia',
    region: 'Khu vực',
    updatedAt: 'Thời gian cập nhật',
  },
  en: {
    id: 'ID',
    companyNameVi: 'Company Name (VI)',
    companyNameEn: 'Company Name (EN)',
    companyNameZh: 'Company Name (ZH)',
    industry: 'Industry',
    active: 'Active',
    allEmails: 'All Emails',
    allPhones: 'All Phones',
    website: 'Website',
    address: 'Address',
    taxId: 'Tax ID',
    country: 'Country',
    region: 'Region',
    updatedAt: 'Updated At',
  },
  zh: {
    id: 'ID',
    companyNameVi: '公司名称 (VI)',
    companyNameEn: '公司名称 (EN)',
    companyNameZh: '公司名称 (ZH)',
    industry: '行业',
    active: '启用状态',
    allEmails: '所有邮箱',
    allPhones: '所有电话',
    website: '网站',
    address: '地址',
    taxId: '税号',
    country: '国家',
    region: '地区',
    updatedAt: '更新时间',
  },
};

export function getCompanyExportHeaders(locale: CompanyExportLocale): string[] {
  return getCompanyExportColumnOrder(locale).map(
    (key) => EXPORT_HEADERS[locale][key],
  );
}

export function buildCompanyExportFilename(
  locale: CompanyExportLocale,
  type: CompanyExportFileType,
): string {
  const datePart = new Date().toISOString().slice(0, 10);
  const extension = type === COMPANY_EXPORT_CSV_TYPE ? 'csv' : 'xlsx';
  return `companies-export-${locale}-${datePart}.${extension}`;
}
