// Minimal types for the Node built-ins used by test helpers only. Declared here instead of
// adding @types/node app-wide, which would let Node-only APIs slip into app code unnoticed.

declare module 'node:sqlite' {
  type Row = Record<string, unknown>;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
      get(...params: unknown[]): Row | undefined;
      all(...params: unknown[]): Row[];
    };
    close(): void;
  }
}

declare module 'crypto' {
  export function randomBytes(size: number): Uint8Array;
  export function randomUUID(): string;
}
