// Load every crop JSON from data/crops (skipping the _SCHEMA doc).
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Crop } from '../src/timing/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const CROPS_DIR = join(here, '..', 'data', 'crops')

export function loadCrops(): Crop[] {
  return readdirSync(CROPS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(CROPS_DIR, f), 'utf8')) as Crop)
}
