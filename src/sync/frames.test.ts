import { randomBytes } from 'crypto';

import { FrameAuthError, FrameCodec, type Message } from './frames';

const random = (n: number) => new Uint8Array(randomBytes(n));
const key = random(32);

/** Two ends of one connection, past the hellos. */
function connected() {
  const a = new FrameCodec(key, 'family', random);
  const b = new FrameCodec(key, 'family', random);
  b.push(a.encode({ t: 'hello', v: 4, deviceId: 'a', name: 'A', nonce: a.nonce }));
  a.push(b.encode({ t: 'hello', v: 4, deviceId: 'b', name: 'B', nonce: b.nonce }));
  b.take();
  a.take();
  a.secure(b.nonce);
  b.secure(a.nonce);
  return { a, b };
}

const done: Message = { t: 'done' };

describe('FrameCodec', () => {
  it('carries messages both ways after the hellos', () => {
    const { a, b } = connected();
    b.push(a.encode(done));
    a.push(b.encode({ t: 'ack' }));
    expect(b.take()).toEqual(done);
    expect(a.take()).toEqual({ t: 'ack' });
  });

  it('refuses a message recorded from an earlier connection', () => {
    const first = connected();
    const recorded = first.a.encode(done);
    const { b } = connected();
    b.push(recorded);
    expect(() => b.take()).toThrow(FrameAuthError);
  });

  it('notices a dropped message', () => {
    const { a, b } = connected();
    a.encode(done); // lost on the way
    b.push(a.encode({ t: 'ack' }));
    expect(() => b.take()).toThrow(FrameAuthError);
  });

  it('refuses a message sent back to its sender', () => {
    const { a } = connected();
    a.push(a.encode(done));
    expect(() => a.take()).toThrow(FrameAuthError);
  });

  it('accepts only a hello-sized first frame from a stranger', () => {
    const codec = new FrameCodec(key, 'family', random);
    const header = new Uint8Array(4);
    new DataView(header.buffer).setUint32(0, 1024 * 1024);
    expect(() => codec.push(header)).toThrow(FrameAuthError);
  });

  it('refuses a hello sealed with another key', () => {
    const stranger = new FrameCodec(random(32), 'family', random);
    const codec = new FrameCodec(key, 'family', random);
    expect(() =>
      codec.push(
        stranger.encode({ t: 'hello', v: 4, deviceId: 'x', name: 'X', nonce: stranger.nonce }),
      ),
    ).toThrow(FrameAuthError);
  });

  it('refuses its own value as the other phone’s', () => {
    const codec = new FrameCodec(key, 'family', random);
    expect(() => codec.secure(codec.nonce)).toThrow(FrameAuthError);
  });
});
