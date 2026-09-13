// One-shot: add the PRD §8.1 fields to every crop file (2026-09-13).
// Values from general horticultural references (NL seed packets, Groei & Bloei,
// Makkelijke Moestuin). Grower spot-check is Phase 3 scope — see _SCHEMA.md.
// Re-runnable: rewrites the fields from this table every time.

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Crop, WaterCadence } from '../src/timing/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const CROPS = join(here, '..', 'data', 'crops')
const IMAGES = join(here, '..', '..', 'cropsy-mobile', 'assets', 'crops')

// [difficulty, depth_mm, germination_days, days_to_transplant, feed_cadence_days, perennial]
type Row = [1 | 2 | 3, number | null, number | null, number | null, number | null, boolean]
const T: Record<string, Row> = {
  asparagus:        [3, 150, null, null, 28, true],
  aubergine:        [3, 5, 10, 63, 14, false],
  basil:            [1, 3, 7, 35, 14, false],
  beetroot:         [1, 20, 10, 28, null, false],
  'broad-bean':     [1, 50, 14, 28, null, false],
  broccoli:         [2, 10, 7, 35, 21, false],
  'brussels-sprouts': [2, 10, 7, 35, 21, false],
  cabbage:          [2, 10, 7, 35, 21, false],
  carrot:           [2, 10, 14, null, null, false],
  cauliflower:      [3, 10, 7, 35, 21, false],
  celeriac:         [3, 3, 14, 70, 14, false],
  celery:           [3, 3, 14, 63, 14, false],
  chili:            [2, 5, 12, 63, 14, false],
  chives:           [1, 5, 14, 42, null, true],
  coriander:        [1, 10, 10, null, null, false],
  courgette:        [1, 20, 7, 21, 14, false],
  cucumber:         [2, 20, 7, 21, 14, false],
  dill:             [1, 5, 12, null, null, false],
  endive:           [2, 10, 7, 28, null, false],
  fennel:           [2, 10, 10, 28, null, false],
  'french-bean':    [1, 40, 8, 21, null, false],
  garlic:           [1, 50, null, null, null, false],
  gherkin:          [2, 20, 7, 21, 14, false],
  kale:             [1, 10, 7, 35, 21, false],
  kohlrabi:         [1, 10, 7, 28, null, false],
  'lambs-lettuce':  [1, 10, 12, null, null, false],
  leek:             [2, 10, 14, 70, 21, false],
  lettuce:          [1, 5, 7, 28, null, false],
  mangetout:        [1, 40, 10, 21, null, false],
  melon:            [3, 15, 7, 28, 14, false],
  mint:             [1, 3, 14, 42, null, true],
  onion:            [1, 20, 12, 56, null, false],
  oregano:          [1, 2, 14, 42, null, true],
  'pak-choi':       [1, 10, 6, 21, null, false],
  parsley:          [2, 5, 21, 42, null, false],
  parsnip:          [2, 15, 21, null, null, false],
  pea:              [1, 40, 10, 21, null, false],
  pepper:           [2, 5, 12, 63, 14, false],
  'pointed-cabbage': [2, 10, 7, 35, 21, false],
  potato:           [1, 120, null, null, null, false],
  pumpkin:          [1, 25, 7, 21, 14, false],
  radish:           [1, 10, 5, null, null, false],
  'red-cabbage':    [2, 10, 7, 35, 21, false],
  rhubarb:          [1, 50, null, null, 28, true],
  rocket:           [1, 5, 6, null, null, false],
  rosemary:         [2, 3, 21, 56, null, true],
  'runner-bean':    [1, 50, 10, 21, null, false],
  sage:             [1, 3, 18, 56, null, true],
  shallot:          [1, 20, null, null, null, false],
  sorrel:           [1, 5, 10, 28, null, true],
  spinach:          [1, 15, 8, null, null, false],
  'spring-onion':   [1, 10, 12, null, null, false],
  strawberry:       [1, null, null, null, 14, true],
  swede:            [2, 15, 8, null, null, false],
  sweetcorn:        [2, 30, 8, 21, 14, false],
  'swiss-chard':    [1, 15, 8, 28, null, false],
  thyme:            [2, 2, 18, 56, null, true],
  tomato:           [2, 5, 8, 56, 14, false],
  turnip:           [1, 15, 6, null, null, false],
  'winter-squash':  [1, 25, 7, 21, 14, false],
}

// Only crops that differ from the engine default get an explicit cadence.
const DRY: WaterCadence = { small: 2, medium: 3, large: 5, ground: 7 } // mediterranean herbs
const THIRSTY: WaterCadence = { small: 1, medium: 1, large: 2, ground: 3 } // big-leaf fruiting crops
const CADENCE: Record<string, WaterCadence> = {
  rosemary: DRY, sage: DRY, thyme: DRY, oregano: DRY,
  tomato: THIRSTY, courgette: THIRSTY, cucumber: THIRSTY, gherkin: THIRSTY, pumpkin: THIRSTY,
  'winter-squash': THIRSTY, melon: THIRSTY, celery: THIRSTY,
}

let n = 0
for (const f of readdirSync(CROPS).filter((f) => f.endsWith('.json'))) {
  const path = join(CROPS, f)
  const crop = JSON.parse(readFileSync(path, 'utf8')) as Crop
  const row = T[crop.slug]
  if (!row) throw new Error(`no row for ${crop.slug}`)
  const [difficulty, depth_mm, germination_days, days_to_transplant, feed_cadence_days, perennial] = row
  const image = existsSync(join(IMAGES, `${crop.slug}.jpg`)) ? `${crop.slug}.jpg` : null
  // Rebuild so the new keys land before `sources`/`verified`, matching types.ts.
  const { sources, verified, ...rest } = crop
  const next = {
    ...rest,
    difficulty,
    water_cadence_days: CADENCE[crop.slug] ?? null,
    feed_cadence_days,
    depth_mm,
    germination_days,
    days_to_transplant,
    perennial,
    image,
    sources,
    verified,
  }
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n')
  n++
}
console.log(`updated ${n} crops`)
