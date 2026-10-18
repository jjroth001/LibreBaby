import type { SQLiteDatabase } from 'expo-sqlite';

import { notifyDbChanged } from '@/db/db-changes';

import { applyChanges, collectChanges, currentChangeSeq, reconcileRunningTimers } from './changes';
import { isSessionNonce, type Message } from './frames';

/** A connected, already-encrypted message pipe to one other phone. */
export type Channel = {
  /** This phone's random value for this connection's keys, sent in its hello. */
  nonce: string;
  /** After the hellos: switch to keys made for this connection from both phones' values. */
  secure(peerNonce: string): void;
  send(message: Message): Promise<void>;
  /** Resolves with the next message; rejects if the connection closes or stalls (or after `timeoutMs`). */
  next(timeoutMs?: number): Promise<Message>;
  close(): void;
};

export type SyncResult = {
  peer: { deviceId: string; name: string; port?: number };
  sent: number;
  received: number;
};

/**
 * 2: phones acknowledge what they received before the sender counts it as delivered
 * (1.3.x marked rows sent even when the connection dropped, losing them for good).
 * 3: adds milestone entries, which 1.5.0 and older can't display.
 * 4: each connection uses its own keys, so recorded messages can't be replayed.
 */
const PROTOCOL = 4;

/** A family phone answers at once; a connection that says nothing is dropped sooner. */
const HELLO_TIMEOUT_MS = 8_000;
const MAX_PEER_NAME = 100;

/** Rows per `changes` message, keeping each frame comfortably small. */
const BATCH = 300;

async function expect<T extends Message['t']>(
  channel: Channel,
  type: T,
  timeoutMs?: number,
): Promise<Extract<Message, { t: T }>> {
  const message = await channel.next(timeoutMs);
  if (message.t !== type)
    throw new Error(`Sync protocol error: expected ${type}, got ${message.t}`);
  return message as Extract<Message, { t: T }>;
}

/**
 * One sync between this phone and a peer. Both sides run the same steps at once:
 * introduce ourselves, send everything changed since we last sent to this peer while
 * merging what it sends, confirm to each other that it's all saved, and only then
 * remember how far we got — so anything lost on the way is simply sent again next time.
 */
export async function runSyncSession(options: {
  db: SQLiteDatabase;
  channel: Channel;
  me: { deviceId: string; name: string; port?: number };
  now?: () => number;
  /** Called once the other phone has proven it's family (its hello opened with our key). */
  onPeer?: (peer: SyncResult['peer']) => void;
}): Promise<SyncResult> {
  const { db, channel, me } = options;
  const now = options.now ?? Date.now;

  await channel.send({
    t: 'hello',
    v: PROTOCOL,
    deviceId: me.deviceId,
    name: me.name,
    ...(me.port ? { port: me.port } : {}),
    nonce: channel.nonce,
  });
  const hello = await expect(channel, 'hello', HELLO_TIMEOUT_MS);
  if (
    typeof hello.v !== 'number' ||
    typeof hello.name !== 'string' ||
    typeof hello.deviceId !== 'string' ||
    !hello.deviceId ||
    hello.deviceId.length > 200
  )
    throw new Error('Sync protocol error: bad hello');
  const peer = {
    deviceId: hello.deviceId,
    name: hello.name.slice(0, MAX_PEER_NAME),
    port:
      Number.isInteger(hello.port) && hello.port! > 0 && hello.port! < 65_536
        ? hello.port
        : undefined,
  };
  // Its hello opened with the family key: a family phone (if perhaps an older version).
  options.onPeer?.(peer);
  if (hello.v !== PROTOCOL)
    throw new Error(
      hello.v < PROTOCOL
        ? `Update LibreBaby on ${peer.name} to sync with it.`
        : 'Update LibreBaby on this phone to sync with the other one.',
    );
  if (hello.deviceId === me.deviceId) throw new Error('Connected to ourselves.');
  if (!isSessionNonce(hello.nonce)) throw new Error('Sync protocol error: bad hello');
  channel.secure(hello.nonce);

  const peerRow = await db.getFirstAsync<{ last_sent_seq: number }>(
    'SELECT last_sent_seq FROM sync_peer WHERE device_id = ?',
    peer.deviceId,
  );
  // Read before collecting: anything changed from here on gets a higher number and goes
  // out next time (at worst a row is sent twice, which merging ignores).
  const sentUpTo = await currentChangeSeq(db);
  const outgoing = await collectChanges(db, peerRow?.last_sent_seq ?? 0);

  const send = async () => {
    // Profiles first, so events always arrive after the child they belong to.
    for (let i = 0; i < Math.max(1, outgoing.events.length); i += BATCH) {
      await channel.send({
        t: 'changes',
        children: i === 0 ? outgoing.children : [],
        events: outgoing.events.slice(i, i + BATCH),
      });
    }
    await channel.send({ t: 'done' });
  };

  const receive = async () => {
    let received = 0;
    for (;;) {
      const message = await channel.next();
      if (message.t === 'done') return received;
      if (message.t !== 'changes') throw new Error(`Sync protocol error: unexpected ${message.t}`);
      if (!Array.isArray(message.children) || !Array.isArray(message.events))
        throw new Error('Sync protocol error: bad changes');
      received += await applyChanges(db, message);
    }
  };

  const [, received] = await Promise.all([send(), receive()]);
  // Everything from the other phone is saved: say so, and wait to hear the same back.
  await channel.send({ t: 'ack' });
  await expect(channel, 'ack');
  const reconciled = await reconcileRunningTimers(db, now());

  await db.runAsync(
    `INSERT INTO sync_peer (device_id, name, last_sent_seq, last_synced_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (device_id) DO UPDATE SET name = excluded.name,
       last_sent_seq = excluded.last_sent_seq, last_synced_at = excluded.last_synced_at`,
    peer.deviceId,
    peer.name,
    sentUpTo,
    now(),
  );
  // Screens heard about these writes before they were committed (this is its own
  // connection); now that they're saved, have them read again.
  if (received + reconciled > 0) notifyDbChanged(['event', 'child']);

  return {
    peer,
    sent: outgoing.children.length + outgoing.events.length,
    received,
  };
}
