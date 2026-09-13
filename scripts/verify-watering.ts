// Deterministic check of the watering generator + fixture for Dart parity.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { wateringIntervalDays, wateringTasksFor } from '../src/timing/watering.ts'

const cases = [
  { plantId: 'p1', cropSlug: 'basil', potLitres: 3, today: '2026-06-01' },
  { plantId: 'p2', cropSlug: 'lettuce', potLitres: 10, today: '2026-06-01' },
  { plantId: 'p3', cropSlug: 'tomato', potLitres: 20, today: '2026-06-01' },
  { plantId: 'p4', cropSlug: 'courgette', potLitres: null, today: '2026-06-01' },
  // Crop override: mediterranean herb in a small pot waters every 2 days.
  { plantId: 'p5', cropSlug: 'rosemary', potLitres: 3, today: '2026-06-01', cadence: { small: 2, medium: 3, large: 5, ground: 7 } },
  // 14-day horizon crosses a month boundary.
  { plantId: 'p6', cropSlug: 'tomato', potLitres: 8, today: '2026-06-25', horizonDays: 14 },
]
const fixture = { cases: cases.map((c) => ({ input: { ...c, horizonDays: c.horizonDays ?? 7, cadence: c.cadence ?? null }, tasks: wateringTasksFor(c) })) }

const checks: [string, boolean][] = [
  ['3 L pot is daily', wateringIntervalDays(3) === 1],
  ['in-ground every 4 days', wateringIntervalDays(null) === 4],
  ['daily → 7 tasks in 7 days', fixture.cases[0]!.tasks.length === 7],
  ['every 4 days → 2 tasks in 7 days', fixture.cases[3]!.tasks.length === 2],
  ['override respected', fixture.cases[4]!.tasks.length === 4],
  ['month boundary', fixture.cases[5]!.tasks.at(-1)?.due === '2026-07-07'],
]
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
writeFileSync(join(dir, 'watering.fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++ }
console.log(`Wrote docs/fixtures/watering.fixture.json (${cases.length} cases)`)
process.exit(failed ? 1 : 0)
