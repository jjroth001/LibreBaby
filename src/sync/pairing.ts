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

/** Short public tag for discovery: phones can tell "same family" without revealing the id. */
export function familyTag(familyId: string): string {
  return bytesToHex(sha256(utf8ToBytes(familyId))).slice(0, 12);
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
