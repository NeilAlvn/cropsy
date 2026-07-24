// Deterministic verification of the weather-adjustment engine. No network:
// hardcoded observations + tasks → asserted adjustments. Also emits
// docs/fixtures/weather-adjust.fixture.json for Dart parity.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { adjustTasks, type DayObservation, type Task } from '../src/timing/weather-adjust.ts'

// A fortnight of weather: a wet spell early, a cold snap, then warming up.
const obs: DayObservation[] = [
  { date: '2026-05-01', precip_mm: 8, temp_min_c: 6, temp_max_c: 11 },
  { date: '2026-05-02', precip_mm: 6, temp_min_c: 5, temp_max_c: 10 }, // wet + cold
  { date: '2026-05-03', precip_mm: 1, temp_min_c: 5, temp_max_c: 11 },
  { date: '2026-05-04', precip_mm: 0, temp_min_c: 7, temp_max_c: 14 },
  { date: '2026-05-05', precip_mm: 0, temp_min_c: 9, temp_max_c: 17 }, // warmed up (mean 13)
  { date: '2026-05-06', precip_mm: 0, temp_min_c: 10, temp_max_c: 20 },
  { date: '2026-05-07', precip_mm: 0, temp_min_c: 11, temp_max_c: 21 },
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
]

const adjustments = adjustTasks(tasks, obs)
const byId = new Map(adjustments.map((a) => [a.task_id, a]))

const checks: [string, boolean][] = [
  ['wet watering is skipped', byId.get('t-water-wet')?.action === 'skip'],
  ['dry watering unchanged', !byId.has('t-water-dry')],
  ['cold sow deferred to 2026-05-05', byId.get('t-sow-cold')?.action === 'defer' && byId.get('t-sow-cold')?.to === '2026-05-05'],
  ['warm transplant unchanged', !byId.has('t-tp-warm')],
  ['harvest never adjusted', !byId.has('t-harvest')],
  ['only changed tasks returned (2)', adjustments.length === 2],
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
