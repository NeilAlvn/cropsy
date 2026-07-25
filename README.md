# Growit replica — backend, data & timing engine

Container-first vegetable-growing app for the Netherlands & Europe. Tells you
what to do in your garden **this week**, with planting dates + reminders built on
real Dutch/EU weather (KNMI/Open-Meteo) — not US zones.

This repo is the **backend / data / web** half (Aviah). Mobile is Flutter, a
separate repo (Chris). Product context lives in the Farmsy Obsidian vault:
`Ideas/Growit Replica — Project Brief` and the `growit-replica-*.txt` planning
notes.

> **Status:** design-independent basics only — Luuk hasn't greenlit design yet.
> No UI, no web app. Building the parts that can't be wasted: the crop-rule data
> model, the timing engine, the weather integration, and the sync foundation.

## What's here

```
data/crops/         The moat: 60 frost-relative crop rules (JSON). _SCHEMA.md = format.
src/timing/         Pure engines — base schedule (engine) + weather adjustment. No I/O.
src/weather/        Open-Meteo spike: frost profile + rain/temp signal.
supabase/migrations The syncable-table foundation (updated_at + soft-delete + RLS).
docs/API-CONTRACT   The web⇄mobile seam (offline-first, delta sync, two-layer timing).
docs/fixtures/      Day-exact schedule fixture — Dart engine must match it.
scripts/            crop seeder, linter, deterministic verify, live smoke test.
```

> ✅ **All 60 crops are `verified: true`** — timing cross-referenced against
> published NL calendars (≥2 sources each; the linter enforces it). See
> `docs/DATA-VERIFICATION.md` for the method and the timing errors it caught
> (the big one: frost-tender crops must plant out after IJsheiligen, not the
> meteorological last frost). A grower's final spot-check is still recommended
> before launch.

## Try it

```bash
npm install
npm run verify:engine  # deterministic: all 60 crops vs a fixed frost date, no network
npm run verify:adjust  # deterministic: weather adjustment (skip-when-wet, defer-when-cold)
npm run lint:crops     # validate rules + report draft/verified counts
npm run smoke          # live Open-Meteo frost lookup → a dated schedule (needs network)
npm run seed:crops     # regenerate the draft crop JSON from scripts/seed-draft-crops.ts
npm run typecheck
```

## The one idea to hold onto

Timing is **two layers**, both now built and pure:
- **`engine.ts`** — the deterministic `base` schedule from crop rules + frost
  dates. The Flutter client runs the exact same logic **offline**.
- **`weather-adjust.ts`** — the **online, optional** overlay: skip watering when
  it rained, defer sowing while the soil's too cold. Returns deltas only.

Offline, the base schedule stands and never blanks. Both engines take their
inputs as arguments (no clock, no network), so they're fully testable and each
has a day-exact fixture in `docs/fixtures/` for Dart parity.
