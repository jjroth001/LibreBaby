import { checkImportSize, MAX_IMPORT_BYTES } from './data-transfer';

describe('checkImportSize', () => {
  it('accepts normal backups and files of unknown size', () => {
    expect(() => checkImportSize(2 * 1024 * 1024)).not.toThrow();
    expect(() => checkImportSize(MAX_IMPORT_BYTES)).not.toThrow();
    expect(() => checkImportSize(null)).not.toThrow();
    expect(() => checkImportSize(undefined)).not.toThrow();
  });

  it('refuses files too big to be a backup, before reading them', () => {
    expect(() => checkImportSize(MAX_IMPORT_BYTES + 1)).toThrow(/too big/);
    expect(() => checkImportSize(300 * 1024 * 1024)).toThrow('This file is 300 MB');
  });
});
