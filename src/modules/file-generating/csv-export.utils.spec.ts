import { buildCsvBuffer, escapeCsvCell } from './csv-export.utils';

describe('csv-export.utils', () => {
  describe('escapeCsvCell', () => {
    it('quotes values containing commas', () => {
      expect(escapeCsvCell('a,b')).toBe('"a,b"');
    });

    it('escapes double quotes', () => {
      expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    });
  });

  describe('buildCsvBuffer', () => {
    it('prefixes UTF-8 BOM for Excel compatibility', () => {
      const buffer = buildCsvBuffer(['ID'], [['uuid-1']]);
      expect(buffer[0]).toBe(0xef);
      expect(buffer[1]).toBe(0xbb);
      expect(buffer[2]).toBe(0xbf);
    });
  });
});
