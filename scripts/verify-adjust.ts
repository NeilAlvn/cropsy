// Deterministic verification of the weather-adjustment engine. No network:
// hardcoded observations + tasks → asserted adjustments. Also emits
// docs/fixtures/weather-adjust.fixture.json for Dart parity.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  adjustTasks,
  DEFAULT_ADJUST,
  type DayObservation,
  type Task,
} from '../src/timing/weather-adjust.ts'

// Two and a half weeks of weather: a wet spell, a cold snap, warming up, then a
// heatwave — with one hot-but-rainy day to prove the heat rule respects rain.
const obs: DayObservation[] = [
  { date: '2026-05-01', precip_mm: 8, temp_min_c: 6, temp_max_c: 11 },
  { date: '2026-05-02', precip_mm: 6, temp_min_c: 5, temp_max_c: 10 }, // wet + cold
  { date: '2026-05-03', precip_mm: 1, temp_min_c: 5, temp_max_c: 11 },
  { date: '2026-05-04', precip_mm: 0, temp_min_c: 7, temp_max_c: 14 },
  { date: '2026-05-05', precip_mm: 0, temp_min_c: 9, temp_max_c: 17 }, // warmed up (mean 13)
  { date: '2026-05-06', precip_mm: 0, temp_min_c: 10, temp_max_c: 20 },
  { date: '2026-05-07', precip_mm: 0, temp_min_c: 11, temp_max_c: 21 },
  { date: '2026-05-08', precip_mm: 0, temp_min_c: 12, temp_max_c: 22 },
  { date: '2026-05-09', precip_mm: 0, temp_min_c: 14, temp_max_c: 25 },
  { date: '2026-05-10', precip_mm: 0, temp_min_c: 18, temp_max_c: 34 }, // hot + dry
  { date: '2026-05-11', precip_mm: 0, temp_min_c: 19, temp_max_c: 35 }, // hot + dry
  { date: '2026-05-12', precip_mm: 0, temp_min_c: 17, temp_max_c: 28 },
  { date: '2026-05-13', precip_mm: 3, temp_min_c: 15, temp_max_c: 26 },
  { date: '2026-05-14', precip_mm: 0, temp_min_c: 14, temp_max_c: 24 },
  { date: '2026-05-15', precip_mm: 5, temp_min_c: 20, temp_max_c: 32 }, // hot but WET
  { date: '2026-05-16', precip_mm: 0, temp_min_c: 18, temp_max_c: 27 },
  { date: '2026-05-17', precip_mm: 0, temp_min_c: 17, temp_max_c: 26 },
]

const tasks: Task[] = [
  // Watering due in the wet spell → should SKIP (8+6+1 = 15mm ≥ 10).
  { id: 't-water-wet', crop_slug: 'tomato', kind: 'water', due: '2026-05-02' },
  // Watering due in the dry spell → should stay (no adjustment).
  { id: 't-water-dry', crop_slug: 'tomato', kind: 'water', due: '2026-05-06' },
  // Direct-sow needing soil ≥12°C, due while cold (mean 7.5) → DEFER to first warm day (05-05, mean 13).
  { id: 't-sow-cold', crop_slug: 'courgette', kind: 'sow', due: '2026-05-02', min_soil_c: 12 },
  // Transplant needing ≥8°C, due when already warm (mean 15) → stay.
  { id: 't-tp-warm', crop_slug: 'lettuce', kind: 'transplant', due: '2026-05-06', min_soil_c: 8 },
  // Harvest is never weather-adjusted → stay.
  { id: 't-harvest', crop_slug: 'radish', kind: 'harvest', due: '2026-05-03' },
  // Watering due 05-12, but 05-10 hits 34°C bone dry → BRING FORWARD to 05-10
  // (the EARLIEST qualifying day, not the closest one).
  { id: 't-water-heat', crop_slug: 'tomato', kind: 'water', due: '2026-05-12' },
  // Watering due 05-16. The only hot day before it (05-15, 32°C) had 5mm rain,
  // over the 2mm dryness limit → must NOT be brought forward.
  { id: 't-water-hot-wet', crop_slug: 'tomato', kind: 'water', due: '2026-05-16' },
  // Container kinds are never weather-adjusted — including in a heatwave, where
  // it would be tempting to "helpfully" move them. Due 05-12, right after the
  // 34/35°C days, so a leaky rule would show up here.
  { id: 't-pot-on', crop_slug: 'tomato', kind: 'pot_on', due: '2026-05-12' },
  { id: 't-thin', crop_slug: 'carrot', kind: 'thin', due: '2026-05-12' },
]

const adjustments = adjustTasks(tasks, obs)
const byId = new Map(adjustments.map((a) => [a.task_id, a]))

// Same heatwave, but "today" is 05-11 — the 05-10 hot day has already passed,
// so the watering may only be pulled forward to 05-11. Guards against the
// engine cheerfully scheduling a task into the past.
const clamped = adjustTasks(
  [{ id: 't-water-heat', crop_slug: 'tomato', kind: 'water', due: '2026-05-12' }],
  obs,
  { ...DEFAULT_ADJUST, today: '2026-05-11' },
)

const checks: [string, boolean][] = [
  ['wet watering is skipped', byId.get('t-water-wet')?.action === 'skip'],
  ['dry watering unchanged', !byId.has('t-water-dry')],
  ['cold sow deferred to 2026-05-05', byId.get('t-sow-cold')?.action === 'defer' && byId.get('t-sow-cold')?.to === '2026-05-05'],
  ['warm transplant unchanged', !byId.has('t-tp-warm')],
  ['harvest never adjusted', !byId.has('t-harvest')],
  ['heat brings watering forward to 2026-05-10', byId.get('t-water-heat')?.action === 'bring_forward' && byId.get('t-water-heat')?.to === '2026-05-10'],
  ['hot but rainy day does NOT bring watering forward', !byId.has('t-water-hot-wet')],
  ['today clamp keeps it out of the past (→ 2026-05-11)', clamped[0]?.action === 'bring_forward' && clamped[0]?.to === '2026-05-11'],
  ['pot_on never adjusted, even in a heatwave', !byId.has('t-pot-on')],
  ['thin never adjusted, even in a heatwave', !byId.has('t-thin')],
  ['only changed tasks returned (3)', adjustments.length === 3],
]

let ok = true
for (const [label, pass] of checks) {
  console.log(`${pass ? '✓' : '✗'} ${label}`)
  if (!pass) ok = false
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
mkdirSync(dir, { recursive: true })
writeFileSync(
  join(dir, 'weather-adjust.fixture.json'),
  JSON.stringify({ observations: obs, tasks, adjustments }, null, 2) + '\n',
)
console.log('\nWrote docs/fixtures/weather-adjust.fixture.json for Dart parity')

if (!ok) { console.log('\n✗ adjustment checks failed'); process.exit(1) }
console.log('✓ all adjustment checks pass')
