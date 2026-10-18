/**
 * Quotes a CSV field when needed (commas, quotes, line breaks), per RFC 4180.
 *
 * Text that starts with = + - @ tab or carriage return gets a leading ' so spreadsheet
 * apps show it as text instead of running it as a formula (a note like "=HYPERLINK(…)"
 * synced from another phone could otherwise do something when the export is opened).
 * Numbers are left alone, so negative values stay numbers.
 */
export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const text =
    typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Byte-order mark, so Excel opens the file as UTF-8 (emoji, accents). */
const BOM = String.fromCharCode(0xfeff);

export function toCsv(rows: (string | number | null | undefined)[][]): string {
  return BOM + rows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/**
 * Parses CSV text (RFC 4180: quoted fields, "" escapes, CRLF or LF, optional BOM)
 * into rows of strings.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
