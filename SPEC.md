# LibreBaby — Product Spec

A free, private, open-source baby tracker. Inspired by the feature set of apps like Huckleberry,
built clean-room: no decompiled code, copied assets, or copied text.

**Phase 1 audience:** our family (Android only, sideloaded APK).
**Later:** public open-source release.

## Principles

1. **One-handed, 3am-friendly.** Logging anything takes ≤ 2 taps from the home screen. Big targets, dark mode by default at night.
2. **Offline-first.** All data lives on the phone (SQLite). The app never needs a network to work.
3. **Private by default.** No accounts, analytics, or third-party services in v1.
4. **Event log is the source of truth.** Everything (sleep, feed, diaper, growth) is a timestamped event; all charts and predictions are derived from it.

## MVP (v1) — scope

### Tracking
| Event | Fields | Interaction |
|---|---|---|
| **Sleep** | start, end, notes | Start/stop timer (survives app close), or manual entry |
| **Feed — breast** | start, end, side (L/R/both), per-side durations | Timer with L/R toggle; remembers last side |
| **Feed — bottle** | time, amount (ml/oz), content (breast milk/formula) | Quick entry with last amount prefilled |
| **Feed — solids** | time, foods, notes | Quick entry |
| **Diaper** | time, wet / dirty / both, notes | One-tap buttons |

All events: editable and deletable after the fact.

### Screens
1. **Home** — "Awake for / last feed / last diaper" tiles, running timer cards, and three log buttons (Sleep · Feed · Diaper) that expand into submenus. Every type can be logged now or entered manually with a past time.
2. **Timeline** — day totals (sleep, feeds, diapers) and that day's entries newest first; ‹ › to change day or tap the date to jump. Tap an entry to edit or delete it.
3. **Insights** — daily totals (sleep hours, # feeds, ml, diapers) and 7-day trend.
4. **Settings** — child profile (name, birth date), units (ml/oz), theme, data export (JSON/CSV) and import.

### Next-nap estimate (our own "sweet spot")
Simple, transparent, and explainable:
- Look up age-based **wake window** range (from published pediatric guidance; table lives in code and is documented).
- Next nap window = end of last sleep + wake window range.
- Personalized (done in M4): after ≥3 daytime wake windows in the last week, the window center moves halfway toward the child's median, clamped to 0.75×–1.25× the age range. Logic + tests: `src/lib/sleep-prediction.ts`.
- Optional notification 5–30 min before the window opens (off by default). Not available in Expo Go (it errors on loading expo-notifications), only in installed builds.

## v2 and later
- **Multi-caregiver sync** — self-hostable sync server (both parents' phones share one log).
- Multiple children.
- Growth tracking (weight/length/head) with WHO percentile charts (public data).
- Pumping, medications, temperature.
- Reminders (e.g. "feed due in ~3h").
- Home-screen widget for one-tap logging.
- Public release: choose license, F-Droid / Play Store listing.

## Data model (v1)

```
child
  id, name, birth_date (local YYYY-MM-DD), created_at, updated_at

setting
  key, value          (app preferences, e.g. units)

event
  id            text (uuid)
  child_id      → child.id
  type          'sleep' | 'feed_breast' | 'feed_bottle' | 'feed_solids' | 'diaper'
  start_at      integer (unix ms)
  end_at        integer (unix ms, null = in progress / instantaneous)
  data          text (JSON, type-specific — see below)
  notes         text
  created_at, updated_at, deleted_at   (soft delete; makes future sync easier)
```

Type-specific `data`:
- `feed_breast`: `{ "side": "L"|"R"|"both", "lastSide": "L"|"R", "leftMs": n, "rightMs": n, "activeSide": "L"|"R"|null, "activeSince": ms|null }` (running timer state lives in the row, so timers survive app restarts)
- `feed_bottle`: `{ "amountMl": n, "content": "breast_milk"|"formula" }`
- `feed_solids`: `{ "foods": string[] }`
- `diaper`: `{ "wet": bool, "dirty": bool }`

Amounts are stored in metric; display units are a setting.

## Tech stack
- Expo SDK 57 + React Native + TypeScript
- Expo Router (file-based navigation, `src/app/`)
- `expo-sqlite` with a small typed data layer (`src/db/`) and `PRAGMA user_version` migrations — no ORM; screens stay live via SQLite change listeners
- `expo-notifications` (nap window alerts)
- Distribution: EAS Build → APK, sideloaded to family phones

## Milestones
1. **M0** — Scaffold, spec, run template on phone via Expo Go. ✅
2. **M1** — Database + data model, child profile setup screen. ✅
3. **M2** — Home screen with sleep, feed, diaper logging + timers. ✅ (also: ml/oz setting, unit tests via `npm test`)
4. **M3** — Timeline + edit/delete. ✅
5. **M4** — Next-nap estimate + notifications. ✅
6. **M5** — Insights, export/import, first APK build for family. ← *next*
