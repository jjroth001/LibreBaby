import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import {
  bytesToHex,
  bytesToUtf8,
  concatBytes,
  hexToBytes,
  utf8ToBytes,
} from '@noble/ciphers/utils.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

import type { ChildRow, EventRow } from '@/db/backup';

/** Protocol messages between two phones. */
export type Message =
  /**
   * `port`: where this phone listens, so the other can dial it back later.
   * `nonce`: this phone's random value for this connection's keys (protocol 4).
   */
  | { t: 'hello'; v: number; deviceId: string; name: string; port?: number; nonce?: string }
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
 * The first frame is the other phone's hello, which proves it has the family key. Until it
 * has, accept no more than a hello needs, so a stranger can't make us buffer megabytes.
 */
const MAX_HELLO_FRAME_BYTES = 16 * 1024;
const SESSION_NONCE_BYTES = 32;
const SESSION_INFO = utf8ToBytes('LibreBaby sync 4');

/** Thrown when a frame doesn't open: wrong family key, or not a LibreBaby peer at all. */
export class FrameAuthError extends Error {
  constructor() {
    super('Could not authenticate the other phone (it may belong to a different family).');
  }
}

export const isSessionNonce = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

type Direction = { key: Uint8Array; count: number };

/**
 * One connection's encryption and framing. On the wire every message is a u32 big-endian
 * length, a random 24-byte nonce and the XChaCha20-Poly1305 ciphertext of its JSON.
 *
 * The two hellos are sealed with the family key (with the family id as associated data),
 * so a phone on an older version can still read ours and ask to be updated. Everything
 * after is sealed with keys made for this connection only, one per direction, from the
 * family key and a fresh random value from each phone; each message also carries its
 * position. So a message recorded from another sync, or replayed, reordered or dropped by
 * someone on the network, doesn't open, and the connection ends.
 */
export class FrameCodec {
  /** This phone's random value for this connection, sent in its hello. */
  readonly nonce: string;
  private buffer = new Uint8Array(0);
  private readonly queue: ({ message: Message } | { body: Uint8Array })[] = [];
  private helloReceived = false;
  private sending: Direction | null = null;
  private receiving: Direction | null = null;
  private readonly familyAd: Uint8Array;

  constructor(
    private readonly familyKey: Uint8Array,
    familyId: string,
    private readonly random: RandomBytes,
  ) {
    this.nonce = bytesToHex(random(SESSION_NONCE_BYTES));
    this.familyAd = utf8ToBytes(familyId);
  }

  /** After the hellos: seal and open everything else with this connection's own keys. */
  secure(peerNonce: string): void {
    if (!isSessionNonce(peerNonce) || peerNonce === this.nonce) throw new FrameAuthError();
    const mine = hexToBytes(this.nonce);
    const theirs = hexToBytes(peerNonce);
    // Each direction's key is salted with the sender's value first, so the two differ.
    const derive = (salt: Uint8Array) => hkdf(sha256, this.familyKey, salt, SESSION_INFO, 32);
    this.sending = { key: derive(concatBytes(mine, theirs)), count: 0 };
    this.receiving = { key: derive(concatBytes(theirs, mine)), count: 0 };
  }

  encode(message: Message): Uint8Array {
    const nonce = this.random(NONCE_BYTES);
    const [key, ad] = this.sealing(this.sending);
    const sealed = xchacha20poly1305(key, nonce, ad).encrypt(utf8ToBytes(JSON.stringify(message)));
    const body = concatBytes(nonce, sealed);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, body.length);
    return concatBytes(header, body);
  }

  /**
   * Reassembles frames from the TCP byte stream (chunks can split or join frames anywhere).
   * The hello is opened straight away; later frames wait for `take`, by which time the
   * session has switched to its own keys. Throws FrameAuthError on anything malformed.
   */
  push(chunk: Uint8Array): void {
    this.buffer = concatBytes(this.buffer, chunk);
    while (this.buffer.length >= 4) {
      const length = new DataView(
        this.buffer.buffer,
        this.buffer.byteOffset,
        this.buffer.byteLength,
      ).getUint32(0);
      const max = this.helloReceived ? MAX_FRAME_BYTES : MAX_HELLO_FRAME_BYTES;
      if (length > max || length <= NONCE_BYTES) throw new FrameAuthError();
      if (this.buffer.length < 4 + length) break;
      const body = this.buffer.slice(4, 4 + length);
      this.buffer = this.buffer.slice(4 + length);
      if (this.helloReceived) {
        this.queue.push({ body });
      } else {
        this.queue.push({ message: this.open(body, this.familyKey, this.familyAd) });
        this.helloReceived = true;
      }
    }
  }

  /** The next complete message, if one has arrived. Throws FrameAuthError if it doesn't open. */
  take(): Message | undefined {
    const item = this.queue.shift();
    if (!item) return undefined;
    if ('message' in item) return item.message;
    // Nothing but a hello may arrive before the keys are switched.
    if (!this.receiving) throw new FrameAuthError();
    const [key, ad] = this.sealing(this.receiving);
    return this.open(item.body, key, ad);
  }

  /** Key and associated data for the next message one way (counting it). */
  private sealing(direction: Direction | null): [Uint8Array, Uint8Array] {
    if (!direction) return [this.familyKey, this.familyAd];
    const count = direction.count++;
    const position = new Uint8Array(8);
    const view = new DataView(position.buffer);
    view.setUint32(0, Math.floor(count / 2 ** 32));
    view.setUint32(4, count >>> 0);
    return [direction.key, concatBytes(this.familyAd, position)];
  }

  private open(body: Uint8Array, key: Uint8Array, ad: Uint8Array): Message {
    let plain: Uint8Array;
    try {
      plain = xchacha20poly1305(key, body.subarray(0, NONCE_BYTES), ad).decrypt(
        body.subarray(NONCE_BYTES),
      );
    } catch {
      throw new FrameAuthError();
    }
    let message: unknown;
    try {
      message = JSON.parse(bytesToUtf8(plain));
    } catch {
      throw new Error('Sync protocol error: unreadable message');
    }
    if (typeof message !== 'object' || message === null || typeof (message as any).t !== 'string')
      throw new Error('Sync protocol error: unreadable message');
    return message as Message;
  }
}
