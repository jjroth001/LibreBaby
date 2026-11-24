/**
 * Syncing over Tailscale, with no setup in LibreBaby: phones that sync at home tell each
 * other their Tailscale addresses (inside the encrypted hello), and remember them. Away
 * from home, when a family phone isn't on the same Wi-Fi, they call those addresses.
 *
 * Only Tailscale's own address ranges are ever sent or dialed, so a phone can't be steered
 * into calling arbitrary hosts.
 */

/** A network address on one of this phone's interfaces (from the BackgroundSync module). */
export type InterfaceAddress = { name: string; address: string };

/** How to reach one family phone over Tailscale. */
export type TailnetPeer = { name: string; port: number; addrs: string[] };
/** Keyed by device id. */
export type TailnetBook = Record<string, TailnetPeer>;

/** Most addresses accepted from one phone (Tailscale gives each phone one IPv4, one IPv6). */
const MAX_ADDRS = 4;
/** Most phones remembered; the oldest entry goes first. */
const MAX_PEERS = 12;

/** "fd7a:115c:a1e0::1%tun0" → "fd7a:115c:a1e0::1"; "::ffff:100.64.0.1" → "100.64.0.1". */
const bare = (address: string) =>
  address
    .trim()
    .toLowerCase()
    .replace(/%.*$/, '')
    .replace(/^::ffff:(?=\d+\.)/, '');

/** Tailscale's ranges: 100.64.0.0/10 (IPv4) and fd7a:115c:a1e0::/48 (IPv6). */
export function isTailscaleAddress(address: string): boolean {
  const a = bare(address);
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    return (
      octets.every((n) => n <= 255) && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127
    );
  }
  return /^fd7a:115c:a1e0:[0-9a-f:]*$/.test(a) && a.length <= 39;
}

/** IPv4 first: it's the address Tailscale shows people, and works on every phone. */
const ipv4First = (addrs: string[]) =>
  [...addrs].sort((x, y) => Number(x.includes(':')) - Number(y.includes(':')));

/**
 * This phone's Tailscale addresses. Tailscale on Android is a VPN, whose interface is a
 * "tun"; carriers can hand out 100.64/10 addresses too, but on their own interfaces.
 */
export function ownTailscaleAddresses(interfaces: InterfaceAddress[]): string[] {
  const found = interfaces
    .filter((i) => i.name.startsWith('tun') && isTailscaleAddress(i.address))
    .map((i) => bare(i.address));
  return ipv4First([...new Set(found)]).slice(0, MAX_ADDRS);
}

/** The Tailscale addresses in another phone's hello, or undefined if it sent none we accept. */
export function peerAddresses(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const addrs = raw
    .slice(0, MAX_ADDRS * 2)
    .filter((a): a is string => typeof a === 'string' && a.length <= 64 && isTailscaleAddress(a))
    .map(bare);
  const unique = ipv4First([...new Set(addrs)]).slice(0, MAX_ADDRS);
  return unique.length ? unique : undefined;
}

/**
 * Notes how to reach a phone after a sync with it. Returns the same book when nothing
 * changed, so callers save only when needed.
 */
export function rememberPeer(
  book: TailnetBook,
  deviceId: string,
  peer: { name: string; port?: number; addrs?: string[] },
): TailnetBook {
  if (!peer.addrs?.length || !peer.port) return book;
  const entry: TailnetPeer = { name: peer.name, port: peer.port, addrs: peer.addrs };
  const old = book[deviceId];
  if (
    old &&
    old.name === entry.name &&
    old.port === entry.port &&
    old.addrs.join() === entry.addrs.join()
  )
    return book;
  const kept = Object.entries(book)
    .filter(([id]) => id !== deviceId)
    .slice(-(MAX_PEERS - 1));
  return { ...Object.fromEntries(kept), [deviceId]: entry };
}

/** Reads a saved book, dropping anything malformed. */
export function parseBook(raw: string | null): TailnetBook {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    let book: TailnetBook = {};
    for (const [deviceId, value] of Object.entries(parsed as Record<string, unknown>)) {
      const v = value as Partial<TailnetPeer> | null;
      if (!v || typeof v.name !== 'string' || !Number.isInteger(v.port)) continue;
      book = rememberPeer(book, deviceId, {
        name: v.name,
        port: v.port,
        addrs: peerAddresses(v.addrs),
      });
    }
    return book;
  } catch {
    return {};
  }
}
