// Deterministic engine verification — NO network. Runs the base schedule for all
// 60 crops against a fixed frost profile and asserts the invariants that must
// always hold. Also emits docs/fixtures/base-schedule.fixture.json so Chris's
// Dart engine can be proven to agree with this TS one to the day.

import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { scheduleGarden, scheduleCrop } from '../src/timing/engine.ts'
import type { FrostProfile } from '../src/timing/types.ts'

// Fixed reference location (typical NL inland). Day-exact and reproducible.
const FROST: FrostProfile = { last_frost: '2026-04-15', first_frost: '2026-11-01' }

const crops = loadCrops()
const schedule = scheduleGarden(crops, FROST)
const failures: string[] = []

// Invariant 1: every window is well-formed (start <= end).
for (const w of schedule) {
  if (w.start > w.end) failures.push(`${w.crop_slug}/${w.method}: start ${w.start} after end ${w.end}`)
}

// Invariant 2: no frost-tender crop exposes a seedling/transplant before last frost.
for (const crop of crops) {
  if (!crop.frost_tender) continue
  for (const w of scheduleCrop(crop, FROST)) {
    if ((w.method === 'transplant' || w.method === 'sow_direct') && w.start < FROST.last_frost) {
      failures.push(`${crop.slug}: ${w.method} at ${w.start} is before last frost ${FROST.last_frost}`)
    }
  }
}

// Invariant 3: every crop produced at least one window.
for (const crop of crops) {
  if (scheduleCrop(crop, FROST).length === 0) failures.push(`${crop.slug}: produced no windows`)
}

console.log(`Engine: ${crops.length} crops → ${schedule.length} windows against fixed frost ${FROST.last_frost}/${FROST.first_frost}`)

// Emit the parity fixture (a handful of representative crops → exact windows).
const sample = ['tomato', 'garlic', 'potato', 'lettuce', 'lambs-lettuce', 'onion']
const fixture = {
  frost: FROST,
  windows: schedule.filter((w) => sample.includes(w.crop_slug)),
}
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'base-schedule.fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
console.log(`Wrote docs/fixtures/base-schedule.fixture.json (${fixture.windows.length} windows, ${sample.length} crops) for Dart parity`)

if (failures.length > 0) {
  console.log(`\n✗ ${failures.length} invariant failures:`)
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('✓ all invariants hold')
