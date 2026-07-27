# Cropsy — backend, data & timing engine

Container-first vegetable-growing app for the Netherlands & Europe. Tells you
what to do in your garden **this week**, with planting dates + reminders built on
real Dutch/EU weather (KNMI/Open-Meteo) — not US zones.

This repo is the **backend / data / web** half (Aviah). Mobile is Flutter, a
separate repo (Chris). Product context lives in the Farmsy Obsidian vault:
`Ideas/Cropsy — Project Brief` (formerly "Growit Replica") and the planning
notes.

> **Status (2026-07-27):** greenlit by Luuk, and the API is **live** at
> `https://growit-replica-ten.vercel.app` (VisionTechBV team on Vercel) —
> `/api/crops`, `/api/frost`, `/api/schedule/weather-adjust`. Mobile has started
> on the Flutter shell. Still open: the Supabase project for the syncable user
> tables, and a grower spot-check of the 60 crops before launch.
>
> **Name:** "Cropsy" as of 2026-07-27. Note that **Cropsy Technologies Ltd**
> (NZ agritech, viticulture vision systems) already trades under this name — a
> proper EUIPO trademark search is outstanding before any spend on branding.

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
