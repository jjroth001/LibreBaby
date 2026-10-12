/** Quotes a CSV field when needed (commas, quotes, line breaks), per RFC 4180. */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Byte-order mark, so Excel opens the file as UTF-8 (emoji, accents). */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}
