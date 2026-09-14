// Fail if the committed snapshot no longer matches data/crops.
//
// The snapshot is committed so the build never depends on generation order.
// The cost of that is drift: edit a crop, forget to regenerate, and the API
// keeps serving the old timing while the repo looks correct. This check makes
// that a hard failure instead of a silent one. Wire it into CI and prebuild.

import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { snapshotVersion, type CropSnapshot } from '../src/crops/snapshot.ts'
import { buildContentSnapshot, type ContentSnapshot } from '../src/content/snapshot.ts'
import { buildOptions, loadContent } from './build-content-snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const FILE = join(here, '..', 'generated', 'crops-snapshot.json')

if (!existsSync(FILE)) {
  console.error(`Missing ${FILE}. Run: npm run snapshot`)
  process.exit(1)
}

const committed = JSON.parse(readFileSync(FILE, 'utf8')) as CropSnapshot
const expected = snapshotVersion(loadCrops())

if (committed.version !== expected) {
  console.error('Snapshot is STALE — data/crops has changed since it was built.')
  console.error(`  committed: ${committed.version}`)
  console.error(`  expected:  ${expected}`)
  console.error('Run `npm run snapshot` and commit the result.')
  process.exit(1)
}

console.log(`✓ snapshot current (${committed.version}, ${committed.crops.length} crops)`)

const CONTENT = join(here, '..', 'generated', 'content-snapshot.json')
const content = existsSync(CONTENT) ? (JSON.parse(readFileSync(CONTENT, 'utf8')) as ContentSnapshot) : null
const expectedContent = buildContentSnapshot(loadContent(), new Date(), buildOptions).version
if (!content || content.version !== expectedContent) {
  console.error('Content snapshot is STALE. Run `npm run snapshot` and commit the result.')
  process.exit(1)
}
console.log(`✓ content snapshot current (${content.version})`)
