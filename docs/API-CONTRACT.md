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

**`GET /api/crops?changed_since=<iso8601>`**

Returns crops changed since the timestamp (omit for a full snapshot). Response
carries a `version` the client stores; a bumped version = re-pull.

```json
{
  "version": "2026-07-24T00:00:00Z",
  "crops": [ /* Crop objects — exact shape in src/timing/types.ts + data/crops/_SCHEMA.md */ ],
  "deleted": ["some-old-slug"]
}
```

The `Crop` object is plain frost-relative data (offsets in weeks from
`last_frost` / `first_frost`). **The client evaluates it locally** — see §4.

---

## 3. Frost profile — per location (cacheable, ship-to-device)

**`GET /api/frost?lat=<n>&lon=<n>`**

Turns a location into the two dates the engine needs. Derived from climate
normals (Open-Meteo/KNMI), so it's stable — cache it hard, refresh rarely.

```json
{ "last_frost": "2026-03-18", "first_frost": "2026-11-21", "source": "open-meteo" }
```

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

**`POST /api/schedule/weather-adjust`**

The base schedule is deterministic; this layer nudges *tasks* using live weather
(skip-when-rained, defer-below-`min_soil_c`, ramp watering in heat). It returns
**deltas only**, applied on top of the base. If the call fails or the device is
offline, the client keeps the base schedule unchanged.

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
- [ ] `docs/fixtures/` shared day-exact test vectors (Aviah, before Chris mirrors §4)
- [ ] Exact `tasks.kind` enum (`water` | `sow` | `transplant` | `harvest` | `feed` …)
- [ ] Whether frost profile is an endpoint or also bundled per-country offline
- [ ] Auth handshake specifics once the Supabase project exists
