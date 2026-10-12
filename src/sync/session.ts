import type { SQLiteDatabase } from 'expo-sqlite';

import { applyChanges, collectChanges, currentChangeSeq, reconcileRunningTimers } from './changes';
import type { Message } from './frames';

/** A connected, already-encrypted message pipe to one other phone. */
export type Channel = {
  send(message: Message): Promise<void>;
  /** Resolves with the next message; rejects if the connection closes or stalls. */
  next(): Promise<Message>;
  close(): void;
};

export type SyncResult = {
  peer: { deviceId: string; name: string };
  sent: number;
  received: number;
};

/** Rows per `changes` message, keeping each frame comfortably small. */
const BATCH = 300;

async function expect<T extends Message['t']>(
  channel: Channel,
  type: T,
): Promise<Extract<Message, { t: T }>> {
  const message = await channel.next();
  if (message.t !== type)
    throw new Error(`Sync protocol error: expected ${type}, got ${message.t}`);
  return message as Extract<Message, { t: T }>;
}

/**
 * One sync between this phone and a peer. Both sides run the same steps at once:
 * introduce ourselves, send everything changed since we last sent to this peer while
 * merging what it sends, then remember how far we got.
 */
export async function runSyncSession(options: {
  db: SQLiteDatabase;
  channel: Channel;
  me: { deviceId: string; name: string };
  now?: () => number;
}): Promise<SyncResult> {
  const { db, channel, me } = options;
  const now = options.now ?? Date.now;

  await channel.send({ t: 'hello', v: 1, deviceId: me.deviceId, name: me.name });
  const hello = await expect(channel, 'hello');
  if (hello.v !== 1) throw new Error('The other phone runs an incompatible LibreBaby version.');
  if (hello.deviceId === me.deviceId) throw new Error('Connected to ourselves.');

  const peerRow = await db.getFirstAsync<{ last_sent_seq: number }>(
    'SELECT last_sent_seq FROM sync_peer WHERE device_id = ?',
    hello.deviceId,
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
      received += await applyChanges(db, message);
    }
  };

  const [, received] = await Promise.all([send(), receive()]);
  await reconcileRunningTimers(db, now());

  await db.runAsync(
    `INSERT INTO sync_peer (device_id, name, last_sent_seq, last_synced_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (device_id) DO UPDATE SET name = excluded.name,
       last_sent_seq = excluded.last_sent_seq, last_synced_at = excluded.last_synced_at`,
    hello.deviceId,
    hello.name,
    sentUpTo,
    now(),
  );

  return {
    peer: { deviceId: hello.deviceId, name: hello.name },
    sent: outgoing.children.length + outgoing.events.length,
    received,
  };
}
