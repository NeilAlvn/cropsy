// Print the dated schedule for given crops against the NL default frost profile.
// Handy for eyeballing whether the rules produce horticulturally sane dates.
//   npx tsx scripts/show-schedule.ts tomato courgette garlic

import { loadCrops } from './loadCrops.ts'
import { scheduleCrop } from '../src/timing/engine.ts'
import type { FrostProfile } from '../src/timing/types.ts'

const FROST: FrostProfile = { last_frost: '2026-04-15', first_frost: '2026-11-01' }
const args = process.argv.slice(2)
const crops = loadCrops().filter((c) => (args.length ? args.includes(c.slug) : true))

console.log(`Frost profile: last ${FROST.last_frost} · first ${FROST.first_frost}\n`)
for (const crop of crops) {
  const flag = crop.verified ? '✓' : '·'
  for (const w of scheduleCrop(crop, FROST)) {
    console.log(`${flag} ${crop.slug.padEnd(14)} ${w.method.padEnd(11)} ${w.start} → ${w.end}`)
  }
}
