import { randomBytes as mockRandomBytes, randomUUID as mockRandomUUID } from 'crypto';

import { hexToBytes } from '@noble/ciphers/utils.js';

import { createChild, getChild } from '@/db/children';
import { insertEvent, listEvents } from '@/db/events';
import { openTestDatabase } from '@/test-utils/node-sqlite';
import { channelPair } from '@/test-utils/sync-channel';

import {
  acceptedTags,
  adoptFamilyChild,
  discoveredPeer,
  discoveryTag,
  familyTag,
  inviteText,
  newFamily,
  parseInvite,
  TAG_PERIOD_MS,
} from './pairing';
import { runSyncSession } from './session';

jest.mock('expo-crypto', () => ({ randomUUID: () => mockRandomUUID() }));

const random = (n: number) => new Uint8Array(mockRandomBytes(n));

describe('invites', () => {
  it('round-trips through the QR text', async () => {
    const db = openTestDatabase();
    const child = await createChild(db, { name: 'Robin', birthDate: '2026-03-14', sex: 'male' });
    const family = newFamily(random, mockRandomUUID);
    expect(parseInvite(inviteText(family, child))).toEqual({
      familyId: family.familyId,
      keyHex: family.keyHex,
      childId: child.id,
      childName: 'Robin',
    });
  });

  it.each([
    ['not json', /isn’t a LibreBaby family code/],
    ['{"app":"Other"}', /isn’t a LibreBaby family code/],
    ['{"app":"LibreBaby","v":2}', /different LibreBaby version/],
    ['{"app":"LibreBaby","v":1,"f":"x","k":"short","c":"c","n":"n"}', /damaged/],
  ])('rejects %s', (text, message) => {
    expect(() => parseInvite(text)).toThrow(message);
  });

  it('derives a short, stable family tag', () => {
    expect(familyTag('abc')).toBe(familyTag('abc'));
    expect(familyTag('abc')).toHaveLength(12);
    expect(familyTag('abc')).not.toBe(familyTag('abd'));
  });
});

describe('discovery', () => {
  const DAY = TAG_PERIOD_MS;
  // A made-up moment in the middle of a tag period.
  const NOW = 20_000 * DAY + DAY / 2;

  it('announces a tag that changes daily and differs between families', () => {
    expect(discoveryTag('abc', NOW)).toBe(discoveryTag('abc', NOW + DAY / 4));
    expect(discoveryTag('abc', NOW)).not.toBe(discoveryTag('abc', NOW + DAY));
    expect(discoveryTag('abc', NOW)).not.toBe(discoveryTag('abd', NOW));
    expect(discoveryTag('abc', NOW)).not.toBe(familyTag('abc'));
  });

  it('accepts a family phone whose clock is up to a day off, or an older version', () => {
    const tags = acceptedTags('abc', NOW);
    expect(tags.has(discoveryTag('abc', NOW - DAY))).toBe(true);
    expect(tags.has(discoveryTag('abc', NOW + DAY))).toBe(true);
    expect(tags.has(familyTag('abc'))).toBe(true);
    expect(tags.has(discoveryTag('abc', NOW + 2 * DAY))).toBe(false);
    expect(tags.has(discoveryTag('abd', NOW))).toBe(false);
  });

  it('finds family phones without their device id, and exactly one side dials', () => {
    const tags = acceptedTags('abc', NOW);
    const f = discoveryTag('abc', NOW);
    const a = { name: 'LibreBaby-aaaa', txt: { f, i: 'aaaa1111' } };
    const b = { name: 'LibreBaby-bbbb', txt: { f, i: 'bbbb2222' } };
    expect(discoveredPeer(b, tags, 'aaaa1111')).toEqual({
      key: 'svc:LibreBaby-bbbb',
      dialFirst: true,
    });
    expect(discoveredPeer(a, tags, 'bbbb2222')).toEqual({
      key: 'svc:LibreBaby-aaaa',
      dialFirst: false,
    });
  });

  it('ignores itself and other families', () => {
    const tags = acceptedTags('abc', NOW);
    const f = discoveryTag('abc', NOW);
    expect(discoveredPeer({ name: 'me', txt: { f, i: 'aaaa1111' } }, tags, 'aaaa1111')).toBeNull();
    const other = { name: 'x', txt: { f: discoveryTag('abd', NOW), i: 'b' } };
    expect(discoveredPeer(other, tags, 'aaaa1111')).toBeNull();
    expect(discoveredPeer({ name: 'x' }, tags, 'aaaa1111')).toBeNull();
  });

  it('calls a phone on an older version so it is told to update', () => {
    const old = { name: 'LibreBaby-0123abcd', txt: { f: familyTag('abc'), d: 'device-id' } };
    expect(discoveredPeer(old, acceptedTags('abc', NOW), 'ffffffff')).toEqual({
      key: 'svc:LibreBaby-0123abcd',
      dialFirst: true,
    });
  });
});

describe('joining a family', () => {
  it('moves this phone’s own entries onto the family’s baby, then syncs both ways', async () => {
    const dad = openTestDatabase();
    const robin = await createChild(dad, { name: 'Robin', birthDate: '2026-03-14', sex: 'male' });
    await insertEvent(dad, {
      childId: robin.id,
      type: 'diaper',
      startAt: 1000,
      data: { wet: true, dirty: false },
    });

    // Mom had been tracking separately, under her own profile.
    const mom = openTestDatabase();
    const momsProfile = await createChild(mom, { name: 'Rob', birthDate: '2026-03-14', sex: null });
    await insertEvent(mom, {
      childId: momsProfile.id,
      type: 'sleep',
      startAt: 2000,
      endAt: 5000,
      data: {},
    });

    const family = newFamily(random, mockRandomUUID);
    const invite = parseInvite(inviteText(family, robin));
    expect(await adoptFamilyChild(mom, invite)).toBe(1);
    expect((await getChild(mom))?.id).toBe(robin.id);

    const key = hexToBytes(family.keyHex);
    const [a, b] = channelPair(key, key, family.familyId);
    await Promise.all([
      runSyncSession({ db: dad, channel: a, me: { deviceId: 'dad', name: 'Dad' } }),
      runSyncSession({ db: mom, channel: b, me: { deviceId: 'mom', name: 'Mom' } }),
    ]);

    for (const db of [dad, mom]) {
      const child = await getChild(db);
      expect(child).toMatchObject({ id: robin.id, name: 'Robin', sex: 'male' });
      const events = await listEvents(db, robin.id, 0, 10_000);
      expect(events.map((e) => e.type).sort()).toEqual(['diaper', 'sleep']);
    }
  });
});
