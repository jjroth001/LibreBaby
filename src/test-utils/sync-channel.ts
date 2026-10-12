/**
 * Test-only: two Channels joined in memory, going through the real encryption and framing
 * (and delivering bytes in random-sized pieces, like a TCP stream), so sync tests exercise
 * everything except the actual sockets.
 */
import { randomBytes } from 'crypto';

import { encodeFrame, FrameReader, type Message } from '@/sync/frames';
import type { Channel } from '@/sync/session';

const random = (n: number) => new Uint8Array(randomBytes(n));

function endpoint(key: Uint8Array, familyId: string) {
  const reader = new FrameReader(key, familyId);
  const inbox: Message[] = [];
  const waiting: { resolve: (m: Message) => void; reject: (e: Error) => void }[] = [];
  let failure: Error | null = null;

  return {
    deliver(bytes: Uint8Array) {
      // Split into random chunks to exercise frame reassembly.
      let offset = 0;
      while (offset < bytes.length) {
        const size = 1 + Math.floor(Math.random() * 97);
        let messages: Message[];
        try {
          messages = reader.push(bytes.subarray(offset, offset + size));
        } catch (error) {
          failure = error as Error;
          waiting.splice(0).forEach((w) => w.reject(failure!));
          return;
        }
        offset += size;
        for (const m of messages) {
          const w = waiting.shift();
          if (w) w.resolve(m);
          else inbox.push(m);
        }
      }
    },
    next(): Promise<Message> {
      if (failure) return Promise.reject(failure);
      const m = inbox.shift();
      if (m) return Promise.resolve(m);
      return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
    },
    encode: (message: Message) => encodeFrame(key, familyId, message, random),
    fail(error: Error) {
      if (failure) return;
      failure = error;
      waiting.splice(0).forEach((w) => w.reject(error));
    },
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
): [Channel, Channel] {
  const a = endpoint(keyA, familyIdA);
  const b = endpoint(keyB, familyIdB);
  let sentByA = 0;
  let stall: ReturnType<typeof setTimeout> | undefined;
  const make = (self: typeof a, other: typeof b, isA: boolean): Channel => ({
    async send(message) {
      const bytes = self.encode(message);
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
