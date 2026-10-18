import type TcpSocket from 'react-native-tcp-socket';

import { FrameCodec, type Message, type RandomBytes } from './frames';
import type { Channel } from './session';

type Socket = InstanceType<typeof TcpSocket.Socket>;

/** No message for this long means the other phone went away (left Wi-Fi, app closed). */
const IDLE_TIMEOUT_MS = 20_000;
const CLOSE_GRACE_MS = 5_000;

/** Wraps a TCP socket in the encrypted message Channel the sync session speaks. */
export function socketChannel(
  socket: Socket,
  key: Uint8Array,
  familyId: string,
  random: RandomBytes,
): Channel {
  const codec = new FrameCodec(key, familyId, random);
  let waiter: { resolve: (m: Message) => void; reject: (e: Error) => void } | null = null;
  let failure: Error | null = null;

  const fail = (error: Error) => {
    if (failure) return;
    failure = error;
    waiter?.reject(error);
    waiter = null;
    socket.destroy();
  };

  /** Hands the waiting reader the next message, if one has arrived. */
  const deliver = () => {
    if (!waiter) return;
    try {
      const message = codec.take();
      if (!message) return;
      waiter.resolve(message);
      waiter = null;
    } catch (error) {
      fail(error as Error);
    }
  };

  socket.on('data', (data: string | Uint8Array) => {
    if (typeof data === 'string') return fail(new Error('Unexpected text on the sync connection.'));
    try {
      codec.push(new Uint8Array(data));
    } catch (error) {
      return fail(error as Error);
    }
    deliver();
  });
  socket.on('error', (error: Error) => fail(error));
  socket.on('close', () => fail(new Error('The other phone disconnected.')));

  return {
    nonce: codec.nonce,
    secure: (peerNonce) => codec.secure(peerNonce),
    async send(message) {
      if (failure) throw failure;
      socket.write(codec.encode(message));
    },
    next(timeoutMs = IDLE_TIMEOUT_MS) {
      if (failure) return Promise.reject(failure);
      return new Promise<Message>((resolve, reject) => {
        const timer = setTimeout(
          () => fail(new Error('The other phone stopped responding.')),
          timeoutMs,
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
        deliver();
      });
    },
    close() {
      // end() sends anything still queued before closing; destroy() would drop it.
      // Destroy anyway shortly after, in case the other side never closes its end.
      if (failure) return;
      failure = new Error('Connection closed.');
      socket.end();
      setTimeout(() => socket.destroy(), CLOSE_GRACE_MS);
    },
  };
}
