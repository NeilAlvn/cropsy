// Deterministic check of the timeline engine (PRD §7.2) + fixture for Dart
// parity. The worked example from the PRD: tomato sown indoors, transplant
// logged two weeks late → harvest window shifts +14 days, feeds re-anchor.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { buildPath, logNode, DEFAULT_REPLAN, type ReplanParams } from '../src/timing/replan.ts'

const crops = loadCrops()
const crop = (slug: string) => {
  const c = crops.find((c) => c.slug === slug)
  if (!c) throw new Error(`no crop ${slug}`)
  return c
}

interface Case {
  name: string
  crop_slug: string
  start: { method: 'sow_indoor' | 'sow_direct' | 'transplant' | 'plant'; on: string }
  plant_id: string
  log: { node_id: string; logged_on: string }
  params: ReplanParams
}

const cases: Case[] = [
  {
    name: 'PRD §7.2: transplant 14 days late shifts harvest and feeds',
    crop_slug: 'tomato', start: { method: 'sow_indoor', on: '2027-03-19' }, plant_id: 'tom1',
    log: { node_id: 'tom1-transplant', logged_on: '2027-05-28' },
    params: { ...DEFAULT_REPLAN, firstFrost: '2027-11-01' },
  },
  {
    name: 'within threshold: 3 days late moves nothing',
    crop_slug: 'tomato', start: { method: 'sow_indoor', on: '2027-03-19' }, plant_id: 'tom2',
    log: { node_id: 'tom2-transplant', logged_on: '2027-05-17' },
    params: DEFAULT_REPLAN,
  },
  {
    name: 'late direct sow pushes harvest into the frost margin → warning',
    crop_slug: 'pumpkin', start: { method: 'sow_direct', on: '2027-05-20' }, plant_id: 'pum1',
    log: { node_id: 'pum1-sow', logged_on: '2027-06-20' },
    params: { ...DEFAULT_REPLAN, firstFrost: '2027-10-15' },
  },
  {
    name: 'early: sow 10 days early pulls everything forward',
    crop_slug: 'lettuce', start: { method: 'sow_direct', on: '2027-04-20' }, plant_id: 'let1',
    log: { node_id: 'let1-sow', logged_on: '2027-04-10' },
    params: DEFAULT_REPLAN,
  },
  {
    name: 'bought seedling: harvest counts from the transplant date',
    crop_slug: 'tomato', start: { method: 'transplant', on: '2027-05-20' }, plant_id: 'tom3',
    log: { node_id: 'tom3-transplant', logged_on: '2027-05-20' },
    params: DEFAULT_REPLAN,
  },
]

const fixture = {
  cases: cases.map((c) => {
    const path = buildPath(crop(c.crop_slug), c.start, c.plant_id)
    const result = logNode(path, c.log.node_id, c.log.logged_on, c.params)
    return { ...c, path, result }
  }),
}

const [prd, within, frost, early, bought] = fixture.cases as [typeof fixture.cases[0], typeof fixture.cases[0], typeof fixture.cases[0], typeof fixture.cases[0], typeof fixture.cases[0]]
const byId = (r: typeof prd.result, id: string) => r.nodes.find((n) => n.id === id)!
const checks: [string, boolean][] = [
  ['tomato transplant planned 2027-05-14', byId(prd.result, 'tom1-transplant').planned_due === '2027-05-14'],
  ['shift is +14', prd.result.shift_days === 14],
  ['harvest moved +14', byId(prd.result, 'tom1-harvest').due === '2027-07-27' && byId(prd.result, 'tom1-harvest').planned_due === '2027-07-13'],
  ['harvest window end moved too', byId(prd.result, 'tom1-harvest').until === '2027-08-21'],
  ['four feeds between transplant and harvest', prd.result.nodes.filter((n) => n.kind === 'feed').length === 4],
  ['first feed re-anchored', byId(prd.result, 'tom1-feed-1').due === '2027-06-11'],
  ['pot_on (past) untouched', byId(prd.result, 'tom1-pot_on').due === byId(prd.result, 'tom1-pot_on').planned_due && byId(prd.result, 'tom1-pot_on').moved_reason === null],
  ['moved_reason set on shifted nodes', byId(prd.result, 'tom1-harvest').moved_reason !== null],
  ['no frost warning in June', prd.result.warnings.length === 0],
  ['within threshold: shift 0', within.result.shift_days === 0 && byId(within.result, 'tom2-harvest').due === '2027-07-13'],
  ['within threshold: logged_on recorded', byId(within.result, 'tom2-transplant').logged_on === '2027-05-17'],
  ['frost warning fires', frost.result.warnings.length === 1 && frost.result.warnings[0]!.code === 'harvest_near_frost'],
  ['early sow: negative shift', early.result.shift_days === -10 && byId(early.result, 'let1-harvest').due < byId(early.result, 'let1-harvest').planned_due],
  ['bought seedling: harvest counts from transplant', byId(bought.result, 'tom3-harvest').due === '2027-07-19' && bought.path.length === 1 + 1 + 4],
  ['input not mutated', prd.path.every((n) => n.logged_on === null && n.moved_reason === null)],
]

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
writeFileSync(join(dir, 'replan.fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++ }
console.log(`Wrote docs/fixtures/replan.fixture.json (${cases.length} cases)`)
process.exit(failed ? 1 : 0)
