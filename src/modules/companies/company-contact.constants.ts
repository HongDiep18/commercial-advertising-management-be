export const CONTACT_TYPE = {
  EMAIL: 'email',
  TEL: 'tel',
  CONTACT_PERSON: 'contact_person',
  FAX: 'fax',
  WEBSITE: 'website',
  HOTLINE: 'hotline',
  WECHAT: 'wechat',
  LINE: 'line',
  SKYPE: 'skype',
  ZALO: 'zalo',
  FACEBOOK: 'facebook',
  VIBER: 'viber',
  ADDRESS: 'address',
} as const;

export type ContactTypeValue = (typeof CONTACT_TYPE)[keyof typeof CONTACT_TYPE];
