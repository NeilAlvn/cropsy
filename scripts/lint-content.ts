// Content linter (PRD §8.1): varieties, companions, problems must reference
// real crops, carry sources when verified, and companions can never list a
// pair as both good and bad. Errors fail the build.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import type { Companions, Problem, Variety } from '../src/content/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data')
const crops = new Set(loadCrops().map((c) => c.slug))
const errors: string[] = []
let counts = { varieties: 0, companions: 0, problems: 0 }

function readDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const v = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      return Array.isArray(v) ? (v as T[]) : [v as T]
    })
}

for (const v of readDir<Variety>(join(DATA, 'varieties'))) {
  counts.varieties++
  if (!crops.has(v.crop_slug)) errors.push(`variety ${v.slug}: unknown crop ${v.crop_slug}`)
  if (v.verified && (v.sources?.length ?? 0) < 2) errors.push(`variety ${v.slug}: verified with <2 sources`)
  if (v.days_to_harvest && v.days_to_harvest.min > v.days_to_harvest.max) errors.push(`variety ${v.slug}: days_to_harvest min > max`)
}

const comp = JSON.parse(readFileSync(join(DATA, 'companions.json'), 'utf8')) as Companions
const key = (a: string, b: string) => [a, b].sort().join('|')
const good = new Set(comp.good.map((p) => key(p.a, p.b)))
for (const p of [...comp.good, ...comp.bad]) {
  counts.companions++
  for (const s of [p.a, p.b]) if (!crops.has(s)) errors.push(`companions ${p.a}/${p.b}: unknown crop ${s}`)
  if (p.a === p.b) errors.push(`companions: ${p.a} paired with itself`)
  if (!p.source) errors.push(`companions ${p.a}/${p.b}: missing source`)
}
for (const p of comp.bad) {
  if (good.has(key(p.a, p.b))) errors.push(`companions ${p.a}/${p.b}: listed as both good and bad`)
}

for (const p of readDir<Problem>(join(DATA, 'problems'))) {
  counts.problems++
  for (const s of p.affects) if (!crops.has(s)) errors.push(`problem ${p.slug}: unknown crop ${s}`)
  if (p.parts.length === 0) errors.push(`problem ${p.slug}: no plant parts`)
  if (p.verified && (p.sources?.length ?? 0) < 2) errors.push(`problem ${p.slug}: verified with <2 sources`)
}

for (const e of errors) console.log(`✗ ${e}`)
console.log(`content: ${counts.varieties} varieties · ${counts.companions} companion pairs · ${counts.problems} problems`)
if (errors.length === 0) console.log('✓ no content errors')
process.exit(errors.length ? 1 : 0)
