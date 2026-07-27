// CLI: write the bundled crop snapshot to dist/crops-snapshot.json.
// The logic lives in src/crops/snapshot.ts so routes can reuse it.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { buildSnapshot } from '../src/crops/snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(here, '..', 'dist')
const OUT_FILE = join(OUT_DIR, 'crops-snapshot.json')

const snapshot = buildSnapshot(loadCrops())
const json = JSON.stringify(snapshot, null, 2) + '\n'

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_FILE, json, 'utf8')

console.log(`Snapshot written: ${OUT_FILE}`)
console.log(`  version   ${snapshot.version}`)
console.log(`  crops     ${snapshot.crops.length}`)
console.log(`  size      ${(Buffer.byteLength(json) / 1024).toFixed(1)} kB`)
