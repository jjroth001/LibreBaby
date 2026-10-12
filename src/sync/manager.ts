import { hexToBytes } from '@noble/ciphers/utils.js';
import { getRandomBytes } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';
import type TcpSocketModule from 'react-native-tcp-socket';
import type ZeroconfClass from 'react-native-zeroconf';
import type { Service } from 'react-native-zeroconf';

import type { Family } from './identity';
import { familyTag } from './pairing';
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
 * Runs family sync on the local network while the app is open:
 * - listens for other family phones (TCP server on a random port),
 * - announces itself and looks for them with zeroconf/mDNS,
 * - syncs with each one it finds, and again whenever asked (after local changes, or
 *   "Sync now"). Native modules are loaded lazily — this only runs in installed builds.
 */
export class SyncManager {
  private server: Server | null = null;
  private zeroconf: ZeroconfClass | null = null;
  private tcp: typeof TcpSocketModule | null = null;
  private readonly peers = new Map<string, { host: string; port: number; name: string }>();
  private readonly busy = new Set<string>();
  private readonly key: Uint8Array;
  private readonly tag: string;
  private readonly serviceName: string;
  private stopped = false;

  constructor(
    private readonly db: SQLiteDatabase,
    private readonly family: Family,
    private readonly me: { deviceId: string; name: string },
    private readonly onEvent: (event: SyncEvent) => void,
  ) {
    this.key = hexToBytes(family.keyHex);
    this.tag = familyTag(family.familyId);
    this.serviceName = `LibreBaby-${me.deviceId.slice(0, 8)}`;
  }

  async start(): Promise<void> {
    const [{ default: TcpSocket }, { default: Zeroconf }] = await Promise.all([
      import('react-native-tcp-socket'),
      import('react-native-zeroconf'),
    ]);
    if (this.stopped) return;
    this.tcp = TcpSocket;

    const server = TcpSocket.createServer((socket) => {
      void this.run(socket, null);
    });
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen({ port: 0, host: '0.0.0.0' }, () => resolve());
    });
    const address = server.address();
    if (!address) throw new Error('Could not open the sync port.');

    const zeroconf = new Zeroconf();
    this.zeroconf = zeroconf;
    zeroconf.on('resolved', (service) => this.found(service));
    zeroconf.on('remove', (name) => {
      for (const [id, peer] of this.peers) if (peer.name === name) this.peers.delete(id);
    });
    zeroconf.on('error', (error) =>
      this.onEvent({ type: 'error', message: `Network discovery: ${error.message}` }),
    );
    await zeroconf.publishService({
      ...SERVICE,
      name: this.serviceName,
      port: address.port,
      txt: { f: this.tag, d: this.me.deviceId },
    });
    zeroconf.scan(SERVICE);
  }

  stop(): void {
    this.stopped = true;
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
    for (const deviceId of this.peers.keys()) this.connect(deviceId);
  }

  private found(service: Service) {
    const deviceId = service.txt?.d;
    if (service.txt?.f !== this.tag || !deviceId || deviceId === this.me.deviceId) return;
    const host = service.ipv4?.[0] ?? service.addresses?.[0] ?? service.host;
    if (!host || !service.port) return;
    const isNew = !this.peers.has(deviceId);
    this.peers.set(deviceId, { host, port: service.port, name: service.name });
    // When two phones find each other, only one (the smaller id) dials, so a newly found
    // pair syncs once. Later explicit syncs may come from either side.
    if (isNew && this.me.deviceId < deviceId) this.connect(deviceId);
  }

  private connect(deviceId: string) {
    const peer = this.peers.get(deviceId);
    const tcp = this.tcp;
    if (!peer || !tcp || this.busy.has(deviceId) || this.stopped) return;
    this.busy.add(deviceId);
    const socket = tcp.createConnection({ host: peer.host, port: peer.port }, () => {
      socket.setTimeout(0);
      void this.run(socket, deviceId);
    });
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => socket.destroy());
    socket.once('error', () => this.busy.delete(deviceId));
    socket.once('close', () => this.busy.delete(deviceId));
  }

  private async run(socket: Socket, deviceId: string | null) {
    const channel = socketChannel(socket, this.key, this.family.familyId, getRandomBytes);
    this.onEvent({
      type: 'syncing',
      peerName: deviceId ? (this.peers.get(deviceId)?.name ?? null) : null,
    });
    try {
      const result = await runSyncSession({ db: this.db, channel, me: this.me });
      this.onEvent({
        type: 'synced',
        peerName: result.peer.name,
        received: result.received,
        sent: result.sent,
      });
    } catch (error) {
      this.onEvent({ type: 'error', message: (error as Error).message });
    } finally {
      channel.close();
      if (deviceId) this.busy.delete(deviceId);
    }
  }
}
