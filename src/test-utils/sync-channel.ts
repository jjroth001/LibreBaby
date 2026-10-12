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
  };
}

export function channelPair(
  keyA: Uint8Array,
  keyB: Uint8Array,
  familyIdA = 'family',
  familyIdB = familyIdA,
): [Channel, Channel] {
  const a = endpoint(keyA, familyIdA);
  const b = endpoint(keyB, familyIdB);
  const make = (self: typeof a, other: typeof b): Channel => ({
    async send(message) {
      const bytes = self.encode(message);
      // Deliver asynchronously, like a network.
      await Promise.resolve();
      other.deliver(bytes);
    },
    next: () => self.next(),
    close() {},
  });
  return [make(a, b), make(b, a)];
}

export const newKey = () => random(32);
