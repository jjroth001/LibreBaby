import {
  isTailscaleAddress,
  ownTailscaleAddresses,
  parseBook,
  peerAddresses,
  rememberPeer,
} from './tailnet';

describe('Tailscale addresses', () => {
  it('accepts only Tailscale ranges', () => {
    expect(isTailscaleAddress('100.64.0.1')).toBe(true);
    expect(isTailscaleAddress('100.127.255.254')).toBe(true);
    expect(isTailscaleAddress('100.101.102.103')).toBe(true);
    expect(isTailscaleAddress('100.63.0.1')).toBe(false);
    expect(isTailscaleAddress('100.128.0.1')).toBe(false);
    expect(isTailscaleAddress('192.168.1.5')).toBe(false);
    expect(isTailscaleAddress('100.64.0.256')).toBe(false);
    expect(isTailscaleAddress('fd7a:115c:a1e0::1')).toBe(true);
    expect(isTailscaleAddress('fd7a:115c:a1e0:ab12:4843:cd96:6258:b240')).toBe(true);
    expect(isTailscaleAddress('fd7a:115c:a1e1::1')).toBe(false);
    expect(isTailscaleAddress('example.com')).toBe(false);
    expect(isTailscaleAddress('100.64.0.1.evil.example')).toBe(false);
  });

  it("finds this phone's own addresses on the VPN interface only", () => {
    expect(
      ownTailscaleAddresses([
        { name: 'wlan0', address: '192.168.1.20' },
        // A carrier can use the same IPv4 range on its own interface.
        { name: 'rmnet_data0', address: '100.70.1.2' },
        { name: 'tun0', address: 'fd7a:115c:a1e0::5%tun0' },
        { name: 'tun0', address: '100.88.7.6' },
      ]),
    ).toEqual(['100.88.7.6', 'fd7a:115c:a1e0::5']);
    expect(ownTailscaleAddresses([{ name: 'wlan0', address: '192.168.1.20' }])).toEqual([]);
  });

  it("keeps only Tailscale addresses from another phone's hello", () => {
    expect(peerAddresses(['10.0.0.1', '100.88.7.6', 'fd7a:115c:a1e0::5', 7])).toEqual([
      '100.88.7.6',
      'fd7a:115c:a1e0::5',
    ]);
    expect(peerAddresses(['8.8.8.8'])).toBeUndefined();
    expect(peerAddresses('100.88.7.6')).toBeUndefined();
    expect(peerAddresses(undefined)).toBeUndefined();
  });
});

describe('remembered phones', () => {
  const peer = { name: 'Pixel', port: 47323, addrs: ['100.88.7.6'] };

  it('remembers a phone and returns the same book when nothing changed', () => {
    const book = rememberPeer({}, 'device-b', peer);
    expect(book).toEqual({ 'device-b': peer });
    expect(rememberPeer(book, 'device-b', { ...peer })).toBe(book);
    expect(rememberPeer(book, 'device-b', { ...peer, port: 50000 })['device-b'].port).toBe(50000);
  });

  it('keeps the old address when a phone syncs with Tailscale off', () => {
    const book = rememberPeer({}, 'device-b', peer);
    expect(rememberPeer(book, 'device-b', { name: 'Pixel', port: 47323 })).toBe(book);
  });

  it('keeps at most twelve phones, dropping the oldest', () => {
    let book = {};
    for (let i = 0; i < 15; i++) book = rememberPeer(book, `device-${i}`, peer);
    expect(Object.keys(book)).toHaveLength(12);
    expect(book).not.toHaveProperty('device-0');
    expect(book).toHaveProperty('device-14');
  });

  it('reads a saved book, skipping anything malformed', () => {
    const saved = JSON.stringify({
      good: peer,
      notTailscale: { name: 'X', port: 1, addrs: ['1.2.3.4'] },
      noPort: { name: 'Y', addrs: ['100.88.7.6'] },
    });
    expect(parseBook(saved)).toEqual({ good: peer });
    expect(parseBook('not json')).toEqual({});
    expect(parseBook(null)).toEqual({});
  });
});
