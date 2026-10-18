import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';
import { getRandomBytes } from 'expo-crypto';
import { BackgroundSync } from '@modules/background-sync/src';
import type { SQLiteDatabase } from 'expo-sqlite';
import { AppState } from 'react-native';
import type TcpSocketModule from 'react-native-tcp-socket';
import type ZeroconfClass from 'react-native-zeroconf';
import type { Service } from 'react-native-zeroconf';

import type { Family } from './identity';
import { acceptedTags, discoveredPeer, discoveryTag } from './pairing';
import { runSyncSession } from './session';
import { socketChannel } from './socket-channel';

type Socket = InstanceType<typeof TcpSocketModule.Socket>;
type Server = ReturnType<typeof TcpSocketModule.createServer>;

export type SyncEvent =
  | { type: 'syncing'; peerName: string | null }
  | { type: 'synced'; peerName: string; received: number; sent: number }
  | { type: 'error'; message: string };

const SERVICE = { type: 'librebaby', protocol: 'tcp', domain: 'local.' } as const;
const CONNECT_TIMEOUT_MS = 8_000;
/**
 * Sync this often even without local changes, so the other phone's changes arrive even if
 * its own "sync after a change" couldn't reach us: every minute while the app is open,
 * every five while it runs in the background (changes still sync right away either way).
 */
const PERIODIC_SYNC_MS = 60_000;
const BACKGROUND_EVERY_N_TICKS = 5;
/** Upper bound on keeping the CPU awake for one sync; released as soon as it finishes. */
const SYNC_AWAKE_MS = 45_000;
/**
 * Connections from other devices handled at once. A family has a few phones; anything on
 * the Wi-Fi can connect, so cap it rather than let a stranger open hundreds.
 */
const MAX_INCOMING = 4;

/** An IPv4 peer can show up as "::ffff:192.168.1.5" on a dual-stack socket. */
const plainAddress = (address: string) => address.replace(/^::ffff:/, '');

/** A family phone we can reach. Its device id is known once a sync with it has started. */
type Peer = { host: string; port: number; name: string; deviceId?: string };

/**
 * Runs family sync on the local network while the app is open:
 * - listens for other family phones (TCP server on a random port),
 * - announces itself and looks for them with zeroconf/mDNS,
 * - syncs with each one it finds, again whenever asked (after local changes, or
 *   "Sync now"), and every minute. Native modules are loaded lazily — this only runs in
 *   installed builds.
 */
export class SyncManager {
  private server: Server | null = null;
  private zeroconf: ZeroconfClass | null = null;
  private tcp: typeof TcpSocketModule | null = null;
  /** Keyed by "svc:<service name>" when found on the network, "dev:<id>" when it called us. */
  private readonly peers = new Map<string, Peer>();
  private readonly busy = new Set<string>();
  private readonly key: Uint8Array;
  /** Random for each start, so the announcement can't be tied to this phone over time. */
  private readonly instance = bytesToHex(getRandomBytes(8));
  private readonly serviceName = `LibreBaby-${this.instance.slice(0, 8)}`;
  private publishedTag = '';
  private stopped = false;
  private port = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticks = 0;
  private activeRuns = 0;
  private incoming = 0;

  constructor(
    private readonly db: SQLiteDatabase,
    private readonly family: Family,
    private readonly me: { deviceId: string; name: string },
    private readonly onEvent: (event: SyncEvent) => void,
  ) {
    this.key = hexToBytes(family.keyHex);
  }

  async start(): Promise<void> {
    const [{ default: TcpSocket }, { default: Zeroconf }] = await Promise.all([
      import('react-native-tcp-socket'),
      import('react-native-zeroconf'),
    ]);
    if (this.stopped) return;
    this.tcp = TcpSocket;

    const server = TcpSocket.createServer((socket) => {
      if (this.incoming >= MAX_INCOMING) {
        socket.destroy();
        return;
      }
      this.incoming += 1;
      void this.run(socket, null).finally(() => (this.incoming -= 1));
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ port: 0, host: '0.0.0.0' }, () => resolve());
    });
    const address = server.address();
    if (!address) throw new Error('Could not open the sync port.');
    this.port = address.port;

    const zeroconf = new Zeroconf();
    this.zeroconf = zeroconf;
    zeroconf.on('resolved', (service) => this.found(service));
    zeroconf.on('remove', (name) => {
      for (const [id, peer] of this.peers) if (peer.name === name) this.peers.delete(id);
    });
    zeroconf.on('error', (error) =>
      this.onEvent({ type: 'error', message: `Network discovery: ${error.message}` }),
    );
    await this.publish();
    zeroconf.scan(SERVICE);
    this.timer = setInterval(() => {
      this.ticks += 1;
      // A new day's tag: announce it instead.
      if (discoveryTag(this.family.familyId, Date.now()) !== this.publishedTag) {
        zeroconf
          .unpublishService(this.serviceName)
          .catch(() => {})
          .then(() => this.publish())
          .catch(() => {});
      }
      const open = AppState.currentState === 'active';
      if (open || this.ticks % BACKGROUND_EVERY_N_TICKS === 0) this.syncNow();
    }, PERIODIC_SYNC_MS);
  }

  /** Announces this phone: only today's family tag and a random token, never its id. */
  private async publish(): Promise<void> {
    const zeroconf = this.zeroconf;
    if (!zeroconf || this.stopped) return;
    const tag = discoveryTag(this.family.familyId, Date.now());
    this.publishedTag = tag;
    await zeroconf.publishService({
      ...SERVICE,
      name: this.serviceName,
      port: this.port,
      txt: { f: tag, i: this.instance },
    });
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const zeroconf = this.zeroconf;
    if (zeroconf) {
      zeroconf.unpublishService(this.serviceName).catch(() => {});
      zeroconf.stop();
      zeroconf.removeDeviceListeners();
    }
    this.server?.close();
    this.zeroconf = null;
    this.server = null;
    this.peers.clear();
  }

  /** Phones from this family currently visible on the network. */
  get visiblePeers(): number {
    return this.peers.size;
  }

  /** Sync with every family phone we can see. */
  syncNow(): void {
    for (const key of this.peers.keys()) this.connect(key);
  }

  private found(service: Service) {
    const found = discoveredPeer(
      service,
      acceptedTags(this.family.familyId, Date.now()),
      this.instance,
    );
    if (!found) return;
    const host = service.ipv4?.[0] ?? service.addresses?.[0] ?? service.host;
    if (!host || !service.port) return;
    // A phone that called us before we saw it is already listed under its device id.
    for (const [key, peer] of this.peers) {
      if (key.startsWith('dev:') && peer.host === host && peer.port === service.port) return;
    }
    const previous = this.peers.get(found.key);
    this.peers.set(found.key, { ...previous, host, port: service.port, name: service.name });
    // When two phones find each other, only one dials, so a newly found pair syncs once.
    // Later explicit syncs may come from either side.
    if (!previous && found.dialFirst) this.connect(found.key);
  }

  private connect(key: string) {
    const peer = this.peers.get(key);
    const tcp = this.tcp;
    if (!peer || !tcp || this.busy.has(key) || this.stopped) return;
    this.busy.add(key);
    const socket = tcp.createConnection({ host: peer.host, port: peer.port }, () => {
      socket.setTimeout(0);
      void this.run(socket, key);
    });
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => socket.destroy());
    socket.once('error', () => this.busy.delete(key));
    socket.once('close', () => this.busy.delete(key));
  }

  /**
   * The phone we called under `key` turned out (from its encrypted hello) to be `deviceId`.
   * Note that, and drop any other entry for the same phone so it isn't synced twice.
   */
  private identified(key: string, deviceId: string) {
    const peer = this.peers.get(key);
    if (!peer) return;
    peer.deviceId = deviceId;
    for (const [other, entry] of this.peers) {
      if (other !== key && entry.deviceId === deviceId) this.peers.delete(other);
    }
  }

  /** `key` is the peers entry we called; null when the other phone called us. */
  private async run(socket: Socket, key: string | null) {
    const channel = socketChannel(socket, this.key, this.family.familyId, getRandomBytes);
    // Until the other side proves it's family, it gets no wake lock, no "Syncing…" and no
    // error message: anything on the Wi-Fi can connect.
    let isFamily = false;
    try {
      const result = await runSyncSession({
        db: this.db,
        channel,
        me: { ...this.me, port: this.port },
        onPeer: (peer) => {
          isFamily = true;
          // With the app closed the phone may be dozing; stay awake just long enough to finish.
          this.activeRuns += 1;
          BackgroundSync?.holdAwake(SYNC_AWAKE_MS);
          this.onEvent({ type: 'syncing', peerName: peer.name });
          if (key) this.identified(key, peer.deviceId);
        },
      });
      // A phone that called us may be one network discovery never showed us (it's often
      // one-sided on Android); remember how to reach it so we can sync back too.
      const { deviceId } = result.peer;
      const known = [...this.peers.values()].some((peer) => peer.deviceId === deviceId);
      const host = socket.remoteAddress;
      if (!key && !known && host && result.peer.port) {
        this.peers.set(`dev:${deviceId}`, {
          host: plainAddress(host),
          port: result.peer.port,
          name: result.peer.name,
          deviceId,
        });
      }
      this.onEvent({
        type: 'synced',
        peerName: result.peer.name,
        received: result.received,
        sent: result.sent,
      });
    } catch (error) {
      // A phone we called is one we found as family, so its failures are worth showing.
      if (isFamily || key) this.onEvent({ type: 'error', message: (error as Error).message });
    } finally {
      channel.close();
      if (key) this.busy.delete(key);
      if (isFamily) {
        this.activeRuns -= 1;
        if (this.activeRuns === 0) BackgroundSync?.release();
      }
    }
  }
}
