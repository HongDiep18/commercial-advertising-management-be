import { CONTACT_TYPE } from './company-contact.constants';
import {
  buildAllEmailsFromContacts,
  buildAllPhonesFromContacts,
  resolveCompanyDisplayName,
} from './company-export.utils';

describe('company-export.utils', () => {
  const names = {
    companyNameVi: 'Công ty A',
    companyNameEn: 'Company A',
    companyNameZh: null,
  };

  describe('resolveCompanyDisplayName', () => {
    it('uses zh then en then vi for locale zh', () => {
      expect(resolveCompanyDisplayName(names, 'zh')).toBe('Company A');
    });

    it('uses en then zh then vi for locale en', () => {
      expect(resolveCompanyDisplayName(names, 'en')).toBe('Company A');
    });

    it('uses vi then en then zh for locale vi', () => {
      expect(resolveCompanyDisplayName(names, 'vi')).toBe('Công ty A');
    });
  });

  describe('buildAllEmailsFromContacts', () => {
    it('includes register_email and email without duplicates', () => {
      const value = buildAllEmailsFromContacts([
        { type: CONTACT_TYPE.REGISTER_EMAIL, value: 'A@x.com' },
        { type: CONTACT_TYPE.EMAIL, value: 'a@x.com' },
        { type: CONTACT_TYPE.EMAIL, value: 'b@x.com' },
      ]);
      expect(value).toBe('A@x.com; b@x.com');
    });
  });

  describe('buildAllPhonesFromContacts', () => {
    it('collects tel phone and contact_person values', () => {
      const value = buildAllPhonesFromContacts([
        { type: CONTACT_TYPE.TEL, value: '0281' },
        { type: CONTACT_TYPE.PHONE, value: '0901' },
      ]);
      expect(value).toBe('0281; 0901');
    });
  });
});
