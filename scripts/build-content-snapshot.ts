// CLI: write generated/content-snapshot.json from data/content/*.json.
// Committed for the same reason as crops-snapshot (see build-snapshot.ts).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildContentSnapshot, type ContentData, type ContentSnapshot } from '../src/content/snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data', 'content')
const OUT = join(here, '..', 'generated', 'content-snapshot.json')

function readDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => {
      const v = JSON.parse(readFileSync(join(dir, f), 'utf8'))
      return Array.isArray(v) ? (v as T[]) : [v as T]
    })
}

export function loadContent(): ContentData {
  const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'))
  const root = join(DATA, '..')
  return {
    collections: read('collections.json'),
    monthly_checklist: read('monthly-checklist.json'),
    prices: read('prices.json'),
    varieties: readDir(join(root, 'varieties')),
    companions: JSON.parse(readFileSync(join(root, 'companions.json'), 'utf8')),
    problems: readDir(join(root, 'problems')),
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) main()

function main() {
const snapshot = buildContentSnapshot(loadContent())
const existing: ContentSnapshot | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null
if (existing?.version === snapshot.version) {
  console.log(`Content snapshot unchanged (${snapshot.version})`)
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`Content snapshot written: ${snapshot.version}`)
}
}
