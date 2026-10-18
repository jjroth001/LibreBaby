/**
 * Test-only: two Channels joined in memory, going through the real encryption and framing
 * (and delivering bytes in random-sized pieces, like a TCP stream), so sync tests exercise
 * everything except the actual sockets.
 */
import { randomBytes } from 'crypto';

import { FrameCodec, type Message } from '@/sync/frames';
import type { Channel } from '@/sync/session';

const random = (n: number) => new Uint8Array(randomBytes(n));

function endpoint(key: Uint8Array, familyId: string) {
  const codec = new FrameCodec(key, familyId, random);
  const waiting: { resolve: (m: Message) => void; reject: (e: Error) => void }[] = [];
  let failure: Error | null = null;

  const fail = (error: Error) => {
    if (failure) return;
    failure = error;
    waiting.splice(0).forEach((w) => w.reject(error));
  };
  /** Hands waiting readers whatever has arrived (opened now, as the socket channel does). */
  const flush = () => {
    try {
      while (waiting.length > 0) {
        const m = codec.take();
        if (!m) return;
        waiting.shift()!.resolve(m);
      }
    } catch (error) {
      fail(error as Error);
    }
  };

  return {
    codec,
    deliver(bytes: Uint8Array) {
      // Split into random chunks to exercise frame reassembly.
      let offset = 0;
      while (offset < bytes.length) {
        const size = 1 + Math.floor(Math.random() * 97);
        try {
          codec.push(bytes.subarray(offset, offset + size));
        } catch (error) {
          return fail(error as Error);
        }
        offset += size;
      }
      flush();
    },
    next(): Promise<Message> {
      if (failure) return Promise.reject(failure);
      return new Promise((resolve, reject) => {
        waiting.push({ resolve, reject });
        flush();
      });
    },
    fail,
  };
}

/**
 * `dropAfter`: the first phone's messages after that many are silently lost, while it
 * keeps receiving normally — as when a phone closes the socket before its last writes are
 * flushed. Shortly after, the connection counts as stalled on both sides.
 */
/** Stand-in for the app's idle timeout, short so tests stay fast. */
const STALL_MS = 50;

export function channelPair(
  keyA: Uint8Array,
  keyB: Uint8Array,
  familyIdA = 'family',
  familyIdB = familyIdA,
  dropAfter?: number,
  /** Sees every message's bytes as sent (to record a sync for replaying). */
  sent?: (byA: boolean, bytes: Uint8Array) => void,
): [Channel, Channel] {
  const a = endpoint(keyA, familyIdA);
  const b = endpoint(keyB, familyIdB);
  let sentByA = 0;
  let stall: ReturnType<typeof setTimeout> | undefined;
  const make = (self: typeof a, other: typeof b, isA: boolean): Channel => ({
    nonce: self.codec.nonce,
    secure: (peerNonce) => self.codec.secure(peerNonce),
    async send(message) {
      const bytes = self.codec.encode(message);
      sent?.(isA, bytes);
      // Deliver asynchronously, like a network.
      await Promise.resolve();
      if (isA && dropAfter !== undefined && ++sentByA > dropAfter) {
        // A socket write "succeeds" even when its bytes are later lost (e.g. the sender
        // closes before they're flushed): nobody notices until the connection stalls.
        if (!stall) {
          stall = setTimeout(() => {
            a.fail(new Error('The other phone stopped responding.'));
            b.fail(new Error('The other phone stopped responding.'));
          }, STALL_MS);
        }
        return;
      }
      other.deliver(bytes);
    },
    next: () => self.next(),
    // Like a socket: the other side sees the disconnect.
    close: () => other.fail(new Error('The other phone disconnected.')),
  });
  return [make(a, b, true), make(b, a, false)];
}

export const newKey = () => random(32);

/**
 * A channel that plays back bytes recorded from an earlier sync, as someone on the network
 * could, and ignores what it's sent.
 */
export function replayChannel(
  key: Uint8Array,
  recorded: Uint8Array[],
  familyId = 'family',
): Channel {
  const self = endpoint(key, familyId);
  let played = false;
  return {
    nonce: self.codec.nonce,
    secure: (peerNonce) => self.codec.secure(peerNonce),
    async send() {
      await Promise.resolve();
      if (played) return;
      played = true;
      for (const bytes of recorded) self.deliver(bytes);
    },
    next: () => self.next(),
    close: () => self.fail(new Error('Connection closed.')),
  };
}
