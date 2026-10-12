import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToUtf8, concatBytes, utf8ToBytes } from '@noble/ciphers/utils.js';

import type { ChildRow, EventRow } from '@/db/backup';

/** Protocol messages between two phones. */
export type Message =
  /** `port`: where this phone listens, so the other can dial it back later. */
  | { t: 'hello'; v: number; deviceId: string; name: string; port?: number }
  | { t: 'changes'; children: ChildRow[]; events: EventRow[] }
  | { t: 'done' }
  /** Everything received has been saved; only now may the sender count it as delivered. */
  | { t: 'ack' };

/** Supplies cryptographically random bytes (expo-crypto in the app, node in tests). */
export type RandomBytes = (length: number) => Uint8Array;

const NONCE_BYTES = 24;
/** A frame larger than this is malformed (batches are far smaller). */
const MAX_FRAME_BYTES = 8 * 1024 * 1024;

/**
 * One message on the wire: u32 big-endian length, then a random 24-byte nonce and the
 * XChaCha20-Poly1305 ciphertext of the JSON. The family id is bound in as associated
 * data, so a frame only opens with the right key *and* family.
 */
export function encodeFrame(
  key: Uint8Array,
  familyId: string,
  message: Message,
  random: RandomBytes,
): Uint8Array {
  const nonce = random(NONCE_BYTES);
  const sealed = xchacha20poly1305(key, nonce, utf8ToBytes(familyId)).encrypt(
    utf8ToBytes(JSON.stringify(message)),
  );
  const body = concatBytes(nonce, sealed);
  const header = new Uint8Array(4);
  new DataView(header.buffer).setUint32(0, body.length);
  return concatBytes(header, body);
}

/** Thrown when a frame doesn't open: wrong family key, or not a LibreBaby peer at all. */
export class FrameAuthError extends Error {
  constructor() {
    super('Could not authenticate the other phone (it may belong to a different family).');
  }
}

/**
 * Reassembles frames from a TCP byte stream (chunks can split or join frames anywhere)
 * and decrypts them.
 */
export class FrameReader {
  private buffer = new Uint8Array(0);

  constructor(
    private readonly key: Uint8Array,
    private readonly familyId: string,
  ) {}

  push(chunk: Uint8Array): Message[] {
    this.buffer = concatBytes(this.buffer, chunk);
    const messages: Message[] = [];
    while (this.buffer.length >= 4) {
      const length = new DataView(
        this.buffer.buffer,
        this.buffer.byteOffset,
        this.buffer.byteLength,
      ).getUint32(0);
      if (length > MAX_FRAME_BYTES || length <= NONCE_BYTES) throw new FrameAuthError();
      if (this.buffer.length < 4 + length) break;
      const body = this.buffer.subarray(4, 4 + length);
      this.buffer = this.buffer.slice(4 + length);
      let plain: Uint8Array;
      try {
        plain = xchacha20poly1305(
          this.key,
          body.subarray(0, NONCE_BYTES),
          utf8ToBytes(this.familyId),
        ).decrypt(body.subarray(NONCE_BYTES));
      } catch {
        throw new FrameAuthError();
      }
      messages.push(JSON.parse(bytesToUtf8(plain)) as Message);
    }
    return messages;
  }
}
