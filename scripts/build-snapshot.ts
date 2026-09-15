// CLI: write the crop snapshot the API route serves.
// The logic lives in src/crops/snapshot.ts so routes can reuse it.
//
// The output is COMMITTED, not gitignored. Vercel runs a bare `next build`,
// which skips npm's `prebuild` hook — so a generated-at-deploy-time file simply
// isn't there and the route's import fails. Committing it removes the ordering
// dependency entirely: any build, anywhere, has the data. `npm run
// verify:snapshot` fails if it's stale, so it can't silently drift from
// data/crops.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { buildSnapshot, type CropSnapshot } from '../src/crops/snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(here, '..', 'generated')
const OUT_FILE = join(OUT_DIR, 'crops-snapshot.json')

const includeDrafts = process.env.CONTENT_INCLUDE_DRAFTS === '1'
const snapshot = buildSnapshot(loadCrops(), new Date(), includeDrafts)

// `generated_at` moves on every run, so rewriting unconditionally would dirty
// the working tree on a no-op build. Only write when the DATA changed.
const existing: CropSnapshot | null = existsSync(OUT_FILE)
  ? (JSON.parse(readFileSync(OUT_FILE, 'utf8')) as CropSnapshot)
  : null

if (existing?.version === snapshot.version) {
  console.log(`Snapshot unchanged (${snapshot.version}, ${snapshot.crops.length} crops)`)
} else {
  const json = JSON.stringify(snapshot, null, 2) + '\n'
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(OUT_FILE, json, 'utf8')

  console.log(`Snapshot written: ${OUT_FILE}`)
  console.log(`  version   ${existing ? `${existing.version} → ${snapshot.version}` : snapshot.version}`)
  console.log(`  crops     ${snapshot.crops.length}`)
  console.log(`  size      ${(Buffer.byteLength(json) / 1024).toFixed(1)} kB`)
}
