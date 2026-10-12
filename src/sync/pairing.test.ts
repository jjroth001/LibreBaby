import { randomBytes as mockRandomBytes, randomUUID as mockRandomUUID } from 'crypto';

import { hexToBytes } from '@noble/ciphers/utils.js';

import { createChild, getChild } from '@/db/children';
import { insertEvent, listEvents } from '@/db/events';
import { openTestDatabase } from '@/test-utils/node-sqlite';
import { channelPair } from '@/test-utils/sync-channel';

import { adoptFamilyChild, familyTag, inviteText, newFamily, parseInvite } from './pairing';
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
