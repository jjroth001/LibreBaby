import { bytesToHex } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { Child } from '@/db/types';

import type { Family } from './identity';

/** What the "join" QR code carries: the family's secret and which baby it's for. */
export type Invite = { familyId: string; keyHex: string; childId: string; childName: string };

export function newFamily(random: (n: number) => Uint8Array, uuid: () => string): Family {
  return { familyId: uuid(), keyHex: bytesToHex(random(32)) };
}

export function inviteText(family: Family, child: Child): string {
  return JSON.stringify({
    app: 'LibreBaby',
    v: 1,
    f: family.familyId,
    k: family.keyHex,
    c: child.id,
    n: child.name,
  });
}

/** Reads a scanned QR code. Throws with a user-facing message if it isn't a LibreBaby invite. */
export function parseInvite(text: string): Invite {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('That QR code isn’t a LibreBaby family code.');
  }
  if (raw?.app !== 'LibreBaby') throw new Error('That QR code isn’t a LibreBaby family code.');
  if (raw.v !== 1)
    throw new Error('That code is from a different LibreBaby version. Update both phones.');
  const { f, k, c, n } = raw;
  if (
    typeof f !== 'string' ||
    typeof k !== 'string' ||
    !/^[0-9a-f]{64}$/.test(k) ||
    typeof c !== 'string' ||
    typeof n !== 'string'
  ) {
    throw new Error('That family code is damaged. Show it again on the other phone.');
  }
  return { familyId: f, keyHex: k, childId: c, childName: n };
}

/**
 * The fixed discovery tag announced by versions before 1.14. Still recognised, so a phone
 * that hasn't been updated is found and told to update; never announced any more.
 */
export function familyTag(familyId: string): string {
  return bytesToHex(sha256(utf8ToBytes(familyId))).slice(0, 12);
}

/** How long one discovery tag lasts. */
export const TAG_PERIOD_MS = 24 * 60 * 60 * 1000;

/**
 * Short public tag announced on the Wi-Fi, so family phones can find each other without
 * revealing the family id. It changes every day, so it can't be used to recognise the
 * same family on another network (a café, a hospital) later.
 */
export function discoveryTag(familyId: string, at: number): string {
  const period = Math.floor(at / TAG_PERIOD_MS);
  return bytesToHex(sha256(utf8ToBytes(`librebaby-discovery:${familyId}:${period}`))).slice(0, 16);
}

/**
 * Tags a family phone may be announcing at `at`: today's, yesterday's and tomorrow's (in
 * case its clock is a little off or it hasn't switched yet), and the old fixed one.
 */
export function acceptedTags(familyId: string, at: number): Set<string> {
  return new Set([
    discoveryTag(familyId, at - TAG_PERIOD_MS),
    discoveryTag(familyId, at),
    discoveryTag(familyId, at + TAG_PERIOD_MS),
    familyTag(familyId),
  ]);
}

/**
 * Decides what to do with a phone found by network discovery: null to ignore it, else
 * the key to list it under and whether we call it first. Phones announce only a family
 * tag (`f`) and a random per-launch token (`i`), never their device id; comparing tokens
 * lets each pair agree which side dials.
 */
export function discoveredPeer(
  service: { name: string; txt?: Record<string, string> },
  tags: Set<string>,
  myInstance: string,
): { key: string; dialFirst: boolean } | null {
  const tag = service.txt?.f;
  if (!tag || !tags.has(tag)) return null;
  const instance = service.txt?.i;
  if (instance === myInstance) return null;
  // Phones from before 1.14 announce no token; call them, so they're told to update.
  return { key: `svc:${service.name}`, dialFirst: !instance || myInstance < instance };
}

/**
 * Makes this phone's log the family's: one baby, one shared log. If this phone tracked
 * the baby under its own profile, those entries move to the family's profile id. The
 * family's real profile arrives with the first sync; until then a placeholder with
 * updated_at 0 stands in (so the real one always wins the merge).
 */
export async function adoptFamilyChild(db: SQLiteDatabase, invite: Invite): Promise<number> {
  let moved = 0;
  await db.withTransactionAsync(async () => {
    const local = await db.getFirstAsync<{ id: string; birth_date: string }>(
      'SELECT id, birth_date FROM child ORDER BY created_at LIMIT 1',
    );
    const hasFamilyChild = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM child WHERE id = ?',
      invite.childId,
    );
    if (!hasFamilyChild) {
      await db.runAsync(
        `INSERT INTO child (id, name, birth_date, sex, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 0, 0)`,
        invite.childId,
        invite.childName,
        local?.birth_date ?? new Date().toISOString().slice(0, 10),
      );
    }
    if (local && local.id !== invite.childId) {
      const result = await db.runAsync(
        'UPDATE event SET child_id = ? WHERE child_id = ?',
        invite.childId,
        local.id,
      );
      moved = result.changes;
      await db.runAsync('DELETE FROM child WHERE id = ?', local.id);
    }
  });
  return moved;
}
