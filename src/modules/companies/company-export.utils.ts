import { CONTACT_TYPE } from './company-contact.constants';
import type { CompanyExportLocale } from './company-export.locale';

export type CompanyExportNameFields = {
  companyNameVi: string | null;
  companyNameEn: string | null;
  companyNameZh: string | null;
};

type NameLocaleKey = 'vi' | 'en' | 'zh';

const NAME_FIELD_BY_LOCALE: Record<
  NameLocaleKey,
  keyof CompanyExportNameFields
> = {
  vi: 'companyNameVi',
  en: 'companyNameEn',
  zh: 'companyNameZh',
};

const NAME_FALLBACK_ORDER: Record<
  CompanyExportLocale,
  readonly NameLocaleKey[]
> = {
  zh: ['zh', 'en', 'vi'],
  en: ['en', 'zh', 'vi'],
  vi: ['vi', 'en', 'zh'],
};

const EMAIL_EXPORT_TYPES: readonly string[] = [
  CONTACT_TYPE.REGISTER_EMAIL,
  CONTACT_TYPE.EMAIL,
];

const PHONE_EXPORT_TYPES: readonly string[] = [
  CONTACT_TYPE.TEL,
  CONTACT_TYPE.PHONE,
  CONTACT_TYPE.CONTACT_PERSON,
  CONTACT_TYPE.HOTLINE,
];

const LIST_CELL_SEPARATOR = '; ';

export function resolveCompanyDisplayName(
  names: CompanyExportNameFields,
  locale: CompanyExportLocale,
): string {
  for (const key of NAME_FALLBACK_ORDER[locale]) {
    const field = NAME_FIELD_BY_LOCALE[key];
    const value = names[field]?.trim();
    if (value) {
      return value;
    }
  }
  return '';
}

export function buildAllEmailsFromContacts(
  contacts: ReadonlyArray<{ type: string; value: string }>,
): string {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const contact of contacts) {
    if (!EMAIL_EXPORT_TYPES.includes(contact.type)) {
      continue;
    }
    const trimmed = contact.value.trim();
    if (!trimmed) {
      continue;
    }
    const dedupeKey = trimmed.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    values.push(trimmed);
  }
  return values.join(LIST_CELL_SEPARATOR);
}

export function buildAllPhonesFromContacts(
  contacts: ReadonlyArray<{ type: string; value: string }>,
): string {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const phoneType of PHONE_EXPORT_TYPES) {
    for (const contact of contacts) {
      if (contact.type !== phoneType) {
        continue;
      }
      const trimmed = contact.value.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      values.push(trimmed);
    }
  }
  return values.join(LIST_CELL_SEPARATOR);
}

export function getFirstContactValueByType(
  contacts: ReadonlyArray<{ type: string; value: string }>,
  type: string,
): string {
  const row = contacts.find((contact) => contact.type === type);
  return row?.value.trim() ?? '';
}

export function formatExportActiveLabel(
  isActive: boolean,
  locale: CompanyExportLocale,
): string {
  if (locale === 'vi') {
    return isActive ? 'Có' : 'Không';
  }
  if (locale === 'zh') {
    return isActive ? '是' : '否';
  }
  return isActive ? 'Yes' : 'No';
}

export function formatExportUpdatedAt(
  updatedAt: Date,
  locale: CompanyExportLocale,
): string {
  const localeTag =
    locale === 'vi' ? 'vi-VN' : locale === 'zh' ? 'zh-CN' : 'en-GB';
  return updatedAt.toLocaleString(localeTag, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatExportIndustry(industry: readonly string[]): string {
  return industry.join(', ');
}

type RegionLocaleMap = Record<CompanyExportLocale, string>;

const REGION_TRANSLATIONS: Record<string, RegionLocaleMap> = {
  hcm: { vi: 'TP. Hồ Chí Minh', en: 'Ho Chi Minh', zh: '胡志明市' },
  hanoi: { vi: 'Hà Nội', en: 'Ha Noi', zh: '河內' },
  binhduong: { vi: 'Bình Dương', en: 'Binh Duong', zh: '平陽省' },
  dongnai: { vi: 'Đồng Nai', en: 'Dong Nai', zh: '同奈省' },
  danang: { vi: 'Đà Nẵng', en: 'Da Nang', zh: '峴港' },
  haiphong: { vi: 'Hải Phòng', en: 'Hai Phong', zh: '海防' },
  cantho: { vi: 'Cần Thơ', en: 'Can Tho', zh: '芹苴' },
  hue: { vi: 'Huế', en: 'Hue', zh: '順化' },
  angiang: { vi: 'An Giang', en: 'An Giang', zh: '安江省' },
  bacninh: { vi: 'Bắc Ninh', en: 'Bac Ninh', zh: '北寧省' },
  camau: { vi: 'Cà Mau', en: 'Ca Mau', zh: '金甌省' },
  caobang: { vi: 'Cao Bằng', en: 'Cao Bang', zh: '高平省' },
  dienbien: { vi: 'Điện Biên', en: 'Dien Bien', zh: '奠邊省' },
  daklak: { vi: 'Đắk Lắk', en: 'Dak Lak', zh: '得樂省' },
  dongthap: { vi: 'Đồng Tháp', en: 'Dong Thap', zh: '同塔省' },
  gialai: { vi: 'Gia Lai', en: 'Gia Lai', zh: '嘉萊省' },
  hatinh: { vi: 'Hà Tĩnh', en: 'Ha Tinh', zh: '河靜省' },
  hungyen: { vi: 'Hưng Yên', en: 'Hung Yen', zh: '興安省' },
  khanhhoa: { vi: 'Khánh Hòa', en: 'Khanh Hoa', zh: '慶和省' },
  laichau: { vi: 'Lai Châu', en: 'Lai Chau', zh: '萊州省' },
  langson: { vi: 'Lạng Sơn', en: 'Lang Son', zh: '諒山省' },
  laocai: { vi: 'Lào Cai', en: 'Lao Cai', zh: '老街省' },
  lamdong: { vi: 'Lâm Đồng', en: 'Lam Dong', zh: '林同省' },
  nghean: { vi: 'Nghệ An', en: 'Nghe An', zh: '乂安省' },
  ninhbinh: { vi: 'Ninh Bình', en: 'Ninh Binh', zh: '寧平省' },
  phutho: { vi: 'Phú Thọ', en: 'Phu Tho', zh: '富壽省' },
  quangngai: { vi: 'Quảng Ngãi', en: 'Quang Ngai', zh: '廣義省' },
  quangninh: { vi: 'Quảng Ninh', en: 'Quang Ninh', zh: '廣寧省' },
  quangtri: { vi: 'Quảng Trị', en: 'Quang Tri', zh: '廣治省' },
  sonla: { vi: 'Sơn La', en: 'Son La', zh: '山羅省' },
  tayninh: { vi: 'Tây Ninh', en: 'Tay Ninh', zh: '西寧省' },
  thainguyen: { vi: 'Thái Nguyên', en: 'Thai Nguyen', zh: '太原省' },
  thanhhoa: { vi: 'Thanh Hóa', en: 'Thanh Hoa', zh: '清化省' },
  tuyenquang: { vi: 'Tuyên Quang', en: 'Tuyen Quang', zh: '宣光省' },
  vinhlong: { vi: 'Vĩnh Long', en: 'Vinh Long', zh: '永隆省' },
  'other-vn': { vi: 'Khác', en: 'Other', zh: '其他' },
  taipei: { vi: 'Đài Bắc', en: 'Taipei', zh: '台北市' },
  taichung: { vi: 'Đài Trung', en: 'Taichung', zh: '台中市' },
  kaohsiung: { vi: 'Cao Hùng', en: 'Kaohsiung', zh: '高雄市' },
  'other-tw': { vi: 'Khác', en: 'Other', zh: '其他' },
  beijing: { vi: 'Bắc Kinh', en: 'Beijing', zh: '北京' },
  shanghai: { vi: 'Thượng Hải', en: 'Shanghai', zh: '上海市' },
  shenzhen: { vi: 'Thâm Quyến', en: 'Shenzhen', zh: '深圳市' },
  guangzhou: { vi: 'Quảng Châu', en: 'Guangzhou', zh: '廣州市' },
  zhejiang: { vi: 'Chiết Giang', en: 'Zhejiang', zh: '浙江省' },
  'other-cn': { vi: 'Khác', en: 'Other', zh: '其他' },
  singapore: { vi: 'Singapore', en: 'Singapore', zh: '新加坡' },
  other: { vi: 'Khác', en: 'Other', zh: '其他' },
  'other-region': { vi: 'Khác', en: 'Other', zh: '其他地區' },
};

export function translateRegionForExport(
  region: string,
  locale: CompanyExportLocale,
): string {
  const trimmed = region.trim();
  const translation = REGION_TRANSLATIONS[trimmed.toLowerCase()];
  return translation ? translation[locale] : trimmed;
}
