import type TcpSocket from 'react-native-tcp-socket';

import { encodeFrame, FrameReader, type Message, type RandomBytes } from './frames';
import type { Channel } from './session';

type Socket = InstanceType<typeof TcpSocket.Socket>;

/** No message for this long means the other phone went away (left Wi-Fi, app closed). */
const IDLE_TIMEOUT_MS = 20_000;

/** Wraps a TCP socket in the encrypted message Channel the sync session speaks. */
export function socketChannel(
  socket: Socket,
  key: Uint8Array,
  familyId: string,
  random: RandomBytes,
): Channel {
  const reader = new FrameReader(key, familyId);
  const inbox: Message[] = [];
  let waiter: { resolve: (m: Message) => void; reject: (e: Error) => void } | null = null;
  let failure: Error | null = null;

  const fail = (error: Error) => {
    if (failure) return;
    failure = error;
    waiter?.reject(error);
    waiter = null;
    socket.destroy();
  };

  socket.on('data', (data: string | Uint8Array) => {
    if (typeof data === 'string') return fail(new Error('Unexpected text on the sync connection.'));
    try {
      for (const message of reader.push(new Uint8Array(data))) {
        if (waiter) {
          waiter.resolve(message);
          waiter = null;
        } else {
          inbox.push(message);
        }
      }
    } catch (error) {
      fail(error as Error);
    }
  });
  socket.on('error', (error: Error) => fail(error));
  socket.on('close', () => fail(new Error('The other phone disconnected.')));

  return {
    async send(message) {
      if (failure) throw failure;
      socket.write(encodeFrame(key, familyId, message, random));
    },
    next() {
      if (failure) return Promise.reject(failure);
      const queued = inbox.shift();
      if (queued) return Promise.resolve(queued);
      return new Promise<Message>((resolve, reject) => {
        const timer = setTimeout(
          () => fail(new Error('The other phone stopped responding.')),
          IDLE_TIMEOUT_MS,
        );
        waiter = {
          resolve: (m) => {
            clearTimeout(timer);
            resolve(m);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        };
      });
    },
    close() {
      socket.destroy();
    },
  };
}
