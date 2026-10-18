import { csvField, parseCsv, toCsv } from './csv';

describe('csvField', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('two\nlines')).toBe('"two\nlines"');
  });

  it('defuses text a spreadsheet would run as a formula', () => {
    expect(csvField('=1+1')).toBe("'=1+1");
    expect(csvField('+1')).toBe("'+1");
    expect(csvField('-2 ml')).toBe("'-2 ml");
    expect(csvField('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(csvField('\tTab')).toBe("'\tTab");
    expect(csvField('\rx')).toBe(`"'\rx"`);
    expect(csvField('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });

  it('leaves ordinary text and numbers alone', () => {
    expect(csvField('Bottle 4 oz')).toBe('Bottle 4 oz');
    expect(csvField('a = b')).toBe('a = b');
    expect(csvField(-5)).toBe('-5');
    expect(csvField(12)).toBe('12');
    expect(csvField(null)).toBe('');
  });

  it('round-trips through parseCsv with the guard kept', () => {
    const rows = parseCsv(toCsv([['=cmd', 'ok']]));
    expect(rows).toEqual([["'=cmd", 'ok']]);
  });
});
