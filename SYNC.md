# Family sync (local Wi-Fi, no servers)

Phones in a "family" exchange changes directly over the home network. No accounts, no
cloud, no infrastructure. Syncs whenever two paired phones have LibreBaby open on the
same Wi-Fi.

## Identity and pairing

- Each install has a random **device id**; a family has a random **family id** and a
  32-byte **family key**. All three live in the Android Keystore (expo-secure-store),
  never in the database — so they're not copied into backups.
- **Set up** generates a family and shows a QR code:
  `{ app: "LibreBaby", v: 1, familyId, key, childId, childName }`.
- **Join** scans it. If this phone already has its own baby profile, its entries are
  re-pointed to the family's child (one baby, one log); the family's profile arrives on
  the first sync. A phone can leave the family; its data stays.

## Change tracking

Migration 4 adds `change_seq` to `child` and `event`: on every insert/update a trigger
gives the row the next number from a per-phone counter (`sync_counter`) — including rows
written by merges, so changes relay through any phone to any other. `sync_peer` records,
per peer device, the counter value up to which we've sent it our changes
(`last_sent_seq`). A counter rather than a clock, so no change can ever be skipped.

## Protocol

Over one TCP connection, every frame is `u32 length + XChaCha20-Poly1305(family key)`
with a random nonce and the family id as associated data. A frame that doesn't decrypt
is a stranger: the connection is dropped.

1. `hello` — protocol version (2), device id, name, and the port this phone listens on.
   (Successful decryption is the authentication.) A different version is refused with
   a message asking to update.
2. `changes` — rows whose `change_seq` is above what this peer was last sent,
   in batches; then `done`.
3. Each side merges: a row is written if it's new or its `updated_at` is newer than
   ours (soft deletes are just rows with `deleted_at`).
4. `ack` — each side sends it once everything it received is saved, and waits for the
   other's. Running timers are then reconciled: two running sleeps (or breastfeeds) →
   keep the earlier, delete the other.
5. Only after the peer's `ack` does a side record the counter value it read before
   collecting as `last_sent_seq`. If the connection drops anywhere before that, nothing
   is recorded and the same rows go again next time (merging makes repeats harmless).
   The connection is closed with a graceful `end()` so queued frames are flushed.

Protocol 1 (1.3.x) had no `ack` and closed with `destroy()`: a phone could drop its
own last, still-unflushed frames, yet record them as sent — so they never arrived.

When two phones first discover each other, the one with the smaller device id connects.
After that either side may connect (after a local change, "Sync now", or every minute
while the app is open). Discovery is often one-sided on Android, so a phone that is
connected *to* remembers the caller's address and advertised port, and can call back.

## Discovery

Zeroconf/mDNS service `_librebaby._tcp` with TXT `f` = first 12 hex chars of
SHA-256(family id) (so strangers' phones are ignored without revealing the id).

## What syncs

The baby profile and all entries. Not settings (units, reminders, last backup) — those
are per phone.

## Limits (by design)

- Both phones must be on the same Wi-Fi with the app open (or recently opened); Android
  restricts background networking. Changes made apart sync when you're back together.
- Some guest/public networks block devices from seeing each other.
- Clocks: "newer edit wins" uses each phone's clock; phones set time automatically, so
  this is reliable in practice.
