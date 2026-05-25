const UTF8_BOM = '\uFEFF';

export function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsvContent(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headerLine, ...dataLines].join('\r\n');
}

export function buildCsvBuffer(headers: string[], rows: string[][]): Buffer {
  return Buffer.from(`${UTF8_BOM}${buildCsvContent(headers, rows)}`, 'utf-8');
}
