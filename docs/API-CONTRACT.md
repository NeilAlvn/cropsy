# API Contract — web ⇄ mobile (Growit replica)

Status: **draft v0.1 (2026-07-24)** · owner: Aviah (backend) · consumer: Chris (Flutter)

This is the analogue of Farmsy's `PAYMENTS-INTEGRATION.md`. It encodes the two
architecture decisions from the [[Thread — Aviah ↔ Chris]] so the client can be
**offline-first** and **delta-syncing** by construction. Nothing here needs the
UI to exist — it's the design-independent seam between our halves.

---

## 1. Principles (why the shape is what it is)

1. **The crop rules ship to the device.** They are read-mostly reference data, so
   the client bundles a snapshot and syncs on a version bump. The base planting
   schedule is then computed **on-device** — no network needed to know "sow
   tomatoes next week."
2. **Two-layer timing.** `base` (deterministic, client-computable) + `weather`
   (online, optional). Offline, the app shows the base schedule and never blanks.
3. **Everything user-owned is delta-syncable.** Every syncable row carries
   `updated_at` and a soft-delete `deleted_at`; every list endpoint accepts
   `?changed_since=` and returns tombstones. The client caches and pulls deltas.

---

## 2. Reference data — crop rules (read-mostly, bundled + synced)

**`GET /api/crops`** · **implemented** (`app/api/crops/route.ts`)

Returns the full crop table. Response carries a `version` the client stores; a
changed version = re-pull.

```json
{
  "version": "33d3e8f955a94c8c",
  "generated_at": "2026-07-27T00:00:00.000Z",
  "crops": [ /* Crop objects — exact shape in src/timing/types.ts + data/crops/_SCHEMA.md */ ],
  "deleted": ["some-old-slug"]
}
```

**`version` is a content hash, not a timestamp** (changed from draft v0.1). The
crop table is edited as files, not rows, so there are no per-row timestamps to
answer a `changed_since` query against — and a build-time timestamp would change
on every deploy, making every client re-download 62 kB for nothing. A hash
changes only when the data does.

**Two ways to skip the download**, both returning `304` with an empty body:
- `If-None-Match: "<version>"` — the `version` is also sent as a strong `ETag`.
- `?version=<version>` — same check as a query param, for clients that would
  rather store the string than plumb headers.

`generated_at` is informational only; never compare it.

The `Crop` object is plain frost-relative data (offsets in weeks from
`last_frost` / `first_frost`). **The client evaluates it locally** — see §4.
Only `verified: true` crops are ever served: the build refuses to produce a
snapshot containing draft timing.

---

## 3. Frost profile — per location (cacheable, ship-to-device)

**`GET /api/frost?lat=<n>&lon=<n>`** · **implemented** (`app/api/frost/route.ts`)

Turns a location into the two dates the engine needs. Derived from climate
history (Open-Meteo/KNMI), so it's stable — cache it hard, refresh rarely.

```json
{ "last_frost": "2026-03-18", "first_frost": "2026-11-21", "source": "open-meteo" }
```

- **Coordinates are rounded server-side to 0.1° (~11 km)** before lookup. Frost
  dates don't vary meaningfully below that, it keeps the cache from fragmenting
  into one entry per GPS reading, and we never handle a user's exact position.
  The client can round before sending too; the server rounds regardless.
- `source` is `open-meteo` or `fallback`. **A lookup failure returns `200` with
  the national default, not an error** — a client with no frost profile has no
  schedule at all, so an approximate answer beats a failed one. Treat
  `fallback` as "retry later", not as an error to surface.
- Invalid or missing `lat`/`lon` → `400`.
- Cache: `s-maxage=604800` (a week) on a real answer, `3600` on a fallback.

Client caches this per rounded lat/lon. Offline with no cache → fall back to a
bundled national default (e.g. NL `04-15` / `11-01`) so the base schedule still runs.

---

## 4. The base schedule — computed ON-DEVICE (no endpoint)

Given `crops` (§2) + `frost` (§3), the client runs the same pure algorithm the
server uses (`src/timing/engine.ts`). It's tiny — mirror it in Dart:

```
for each crop, for each method:
    anchor   = method.anchor == "last_frost" ? frost.last_frost : frost.first_frost
    start    = anchor + (method.start_weeks * 7 days)
    end      = anchor + (method.end_weeks   * 7 days)
    → ScheduledWindow { crop_slug, method, start, end, min_soil_c, note }
"this week" = windows whose [start,end] overlaps [today, today+7d]
```

Dart and TS must agree to the day. A shared fixture file (frost profile + a few
crops → expected windows) will live in `docs/fixtures/` so both sides test
against the same numbers. **Do not** add an endpoint for this — putting it
server-side is exactly the offline trap we're avoiding.

---

## 5. The weather adjustment — ONLINE, optional overlay

**`POST /api/schedule/weather-adjust`** · **implemented** (`app/api/schedule/weather-adjust/route.ts`)

The base schedule is deterministic; this layer nudges *tasks* using live weather.
It returns **deltas only**, applied on top of the base. If the call fails or the
device is offline, the client keeps the base schedule unchanged.

**Failure is always `{"adjustments": []}` with `200`** — never a 5xx. An empty
list means "no opinion", which is exactly what the client should do when the
weather is unknown, so there is no error branch to write. Malformed input still
returns `400`: that's a client bug, not a weather outage. Max 500 tasks/request.

Request:
```json
{ "lat": 52.09, "lon": 5.12,
  "tasks": [ { "id": "uuid", "crop_slug": "tomato", "kind": "water", "due": "2026-06-01" } ] }
```
Response:
```json
{ "adjustments": [
  { "task_id": "uuid", "action": "defer", "to": "2026-06-03",
    "reason": { "nl": "Regen verwacht", "en": "Rain expected" } }
] }
```
`action` ∈ `defer` | `skip` | `bring_forward` | `none`. Never destructive; always
carries a localized `reason` (trust). Advisory — the user can override.

**Implemented** in `src/timing/weather-adjust.ts` (pure `adjustTasks(tasks,
observations, params)`, deltas only). Current rules (params in `DEFAULT_ADJUST`):
watering is **skipped** when rain over `[due-2d, due+1d]` ≥ 10 mm; a sow/transplant
gated by `min_soil_c` is **deferred** to the next day mean air-temp (min+max)/2
meets the gate, within 14 days. Day-exact fixture:
`docs/fixtures/weather-adjust.fixture.json`.

**Heat rule (added 2026-07-27).** A watering task is **brought forward** to the
earliest hot, dry day in the 3 days before it's due: `temp_max_c ≥ 30 °C` and
`precip_mm ≤ 2`. A container can go from damp to bone dry in one 30 °C
afternoon, so waiting for the scheduled day is how plants are lost in a
heatwave. Three deliberate constraints:

- **Wet beats hot.** The skip-when-rained check runs first, so we never water
  into saturated soil just because it's warm.
- **A hot day that rained doesn't count** (`heatDryMaxMm`), which is why the
  threshold is a *dry*-heat test rather than a temperature test.
- **Never scheduled into the past.** `today` is passed into `AdjustParams` by
  the route rather than read from a clock inside the engine, so the engine stays
  pure and the fixtures stay reproducible. `today: null` disables the clamp.

30 °C is tuned for **containers**, not open ground — a raised bed buffers heat
far better than a 10-litre pot on a balcony, and containers are this app's whole
premise.

> **Still missing:** the adjuster can only move existing tasks — there is no
> "add a task" delta — so a heatwave with no watering task scheduled anywhere
> nearby still produces no advice. Adding an `add` action is a contract change;
> not doing it unilaterally.

---

## 6. User data — syncable tables (Supabase, delta sync)

Direct Supabase access from Flutter (`supabase_flutter`) under RLS, same pattern
as Farmsy. Syncable tables: `gardens`, `garden_plants`, `tasks`, `journal_entries`.

**Every syncable row guarantees:**
- `id uuid` (client-generatable, so optimistic offline inserts work)
- `updated_at timestamptz` (server-maintained via trigger)
- `deleted_at timestamptz null` (soft delete — never hard-delete a synced row)
- `owner uuid` (RLS: a user sees only their own rows)

**Delta pull:** `select * where owner = auth.uid() and updated_at > <cursor>`
(includes soft-deleted rows as tombstones). **Push:** optimistic local write →
outbox → upsert on reconnect; conflicts resolved **last-write-wins on
`updated_at`** (single-user app, per Chris).

---

## 7. Reused from Farmsy (unchanged contracts)

Payments/subscriptions/trial via **RevenueCat** + `GET /api/profile/status`
(mirror Farmsy incl. the `role`-as-access rule). Auth, email, account deletion:
same as Farmsy. Documented here only so nothing is assumed.

---

## Open (fill in as we build)
- [x] `docs/fixtures/base-schedule.fixture.json` — day-exact test vectors (frost
      profile + crops → expected windows). Chris: your Dart §4 engine must
      reproduce these exactly.
- [x] `tasks.kind` enum — settled as `water` | `sow` | `transplant` | `harvest`
      | `feed` (`TaskKind` in `src/timing/weather-adjust.ts`). Additions are
      backwards-compatible; the adjuster ignores kinds it has no rule for.
- [x] Frost profile is **both**: `GET /api/frost` when online, plus a bundled
      national default the client uses offline (§3). Neither blocks the other.
- [x] Heat rule for watering — shipped 2026-07-27 (§5). Brings watering forward
      onto a hot, dry day; wet still wins; never schedules into the past.
- [ ] Whether to add an `add` action so a heatwave can create a watering task
      where none is scheduled. Contract change — needs Chris's input.
- [ ] Auth handshake specifics once the Supabase project exists
- [ ] Deploy target + base URL for the three endpoints (Vercel project not yet
      created; Chris is on fixtures until it is)
