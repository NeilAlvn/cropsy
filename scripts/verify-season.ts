// Season path checks + fixture for Dart parity.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { seasonPath, DEFAULT_SEASON, type SeasonPlant } from '../src/timing/season.ts'
import type { FrostProfile } from '../src/timing/types.ts'

const crops = loadCrops()
const frost: FrostProfile = { last_frost: '2027-04-15', first_frost: '2027-11-01' }
const plants: SeasonPlant[] = [
  // Broad beans out by mid-June → rucola / radish still sowable.
  { plant_id: 'bb1', crop_slug: 'broad-bean', harvest: { start: '2027-06-01', end: '2027-06-20' } },
  // Tomato harvest runs to late September → little direct-sow left; lamb's lettuce maybe.
  { plant_id: 'tom1', crop_slug: 'tomato', harvest: { start: '2027-07-13', end: '2027-09-25' } },
  // Planning only: no harvest, just its windows.
  { plant_id: 'car1', crop_slug: 'carrot', harvest: null },
]
const nodes = seasonPath(plants, crops, frost)
const fixture = { frost, plants, params: DEFAULT_SEASON, nodes }

const succ = nodes.filter((n) => n.kind === 'succession')
const afterBean = succ.filter((n) => n.after_plant_id === 'bb1')
const checks: [string, boolean][] = [
  ['sow windows exist for all three plants', ['bb1', 'tom1', 'car1'].every((id) => nodes.some((n) => n.kind === 'sow_window' && n.plant_id === id))],
  ['two harvest windows', nodes.filter((n) => n.kind === 'harvest_window').length === 2],
  ['broad bean frees a bed in June → suggestions', afterBean.length === DEFAULT_SEASON.maxSuggestions],
  ['suggestions are quick crops, not what is already growing', afterBean.every((n) => !['broad-bean', 'tomato', 'carrot'].includes(n.crop_slug))],
  ['suggestion starts when the bed frees', afterBean.every((n) => n.start === '2027-06-20')],
  ['sorted by start', nodes.every((n, i) => i === 0 || nodes[i - 1]!.start <= n.start)],
]
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
writeFileSync(join(dir, 'season.fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++ }
console.log(`Wrote docs/fixtures/season.fixture.json (${nodes.length} nodes; succession: ${succ.map((n) => `${n.after_plant_id}→${n.crop_slug}`).join(', ')})`)
process.exit(failed ? 1 : 0)
