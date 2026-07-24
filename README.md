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
data/crops/         The moat: frost-relative crop rules (JSON). _SCHEMA.md = format.
src/timing/         Pure timing engine — rules + frost dates → dated windows. No I/O.
src/weather/        Open-Meteo spike: frost profile + rain/temp signal.
supabase/migrations The syncable-table foundation (updated_at + soft-delete + RLS).
docs/API-CONTRACT   The web⇄mobile seam (offline-first, delta sync, two-layer timing).
scripts/            loadCrops, crop linter, end-to-end smoke test.
```

## Try it

```bash
npm install
npm run lint:crops   # validate the crop rules (bad data = worst bug)
npm run smoke        # real crops + live Open-Meteo frost lookup → a dated schedule
npm run typecheck
```

## The one idea to hold onto

Timing is **two layers**. The `base` schedule is deterministic — computed from
crop rules + frost dates, so the Flutter client runs the exact same logic
**offline**. The `weather` adjustment (skip-when-rained, defer-below-soil-temp)
is an **online, optional** overlay. Offline, the app degrades to the base
schedule and never blanks. Everything in `src/timing` stays pure to protect this.
