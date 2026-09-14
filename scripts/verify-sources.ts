// Dead-link filter for drafted content. Gemini cites plausible URLs that do
// not exist; a source a reviewer cannot open is worse than none. Every URL in
// the draft files is fetched; non-2xx/3xx ones are removed in place.
//
//   npx tsx scripts/verify-sources.ts          # fix files
//   npx tsx scripts/verify-sources.ts --check  # report only, exit 1 on dead links
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data')
const checkOnly = process.argv.includes('--check')
const cache = new Map<string, boolean>()

async function alive(url: string): Promise<boolean> {
  if (cache.has(url)) return cache.get(url)!
  let ok = false
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(12_000), headers: { 'user-agent': 'Mozilla/5.0 (Cropsy source check)' } })
      ok = r.status < 400
      if (ok) break
    } catch { /* try next */ }
  }
  cache.set(url, ok)
  return ok
}

async function filter(urls: string[]): Promise<string[]> {
  const out: string[] = []
  for (const u of urls) if (await alive(u)) out.push(u)
  return out
}

let removed = 0
let kept = 0
function note(before: number, after: number, file: string) {
  removed += before - after
  kept += after
  if (before !== after) console.log(`${file}: ${before} → ${after}`)
}

async function jsonDir(dir: string): Promise<void> {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const path = join(dir, f)
    const raw = JSON.parse(readFileSync(path, 'utf8'))
    const rows = Array.isArray(raw) ? raw : [raw]
    let changed = false
    for (const row of rows) {
      if (!Array.isArray(row.sources)) continue
      const next = await filter(row.sources)
      note(row.sources.length, next.length, `${f}${Array.isArray(raw) ? ` [${row.slug}]` : ''}`)
      if (next.length !== row.sources.length) { row.sources = next; changed = true }
    }
    if (changed && !checkOnly) writeFileSync(path, JSON.stringify(raw, null, 2) + '\n')
  }
}

async function markdownDir(dir: string): Promise<void> {
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const path = join(dir, f)
    const text = readFileSync(path, 'utf8')
    const m = text.match(/^sources:\n((?:  - .*\n)*)/m)
    if (!m) continue
    const urls = m[1]!.split('\n').filter(Boolean).map((l) => l.replace(/^  - /, ''))
    const next = await filter(urls)
    note(urls.length, next.length, f)
    if (next.length !== urls.length && !checkOnly) {
      writeFileSync(path, text.replace(m[0], `sources:\n${next.map((u) => `  - ${u}`).join('\n')}${next.length ? '\n' : ''}`))
    }
  }
}

async function companionsAndPrices(): Promise<void> {
  const cp = join(DATA, 'companions.json')
  const c = JSON.parse(readFileSync(cp, 'utf8')) as { good: { source?: string }[]; bad: { source?: string }[] }
  let n = 0
  for (const row of [...c.good, ...c.bad]) {
    if (row.source && !(await alive(row.source))) { delete row.source; n++ }
  }
  console.log(`companions.json: ${n} dead source links cleared`)
  removed += n
  if (n && !checkOnly) writeFileSync(cp, JSON.stringify(c, null, 2) + '\n')

  const pp = join(DATA, 'content', 'prices.json')
  const p = JSON.parse(readFileSync(pp, 'utf8')) as { source?: string }[]
  let m = 0
  for (const row of p) if (row.source && !(await alive(row.source))) { delete row.source; m++ }
  console.log(`prices.json: ${m} dead source links cleared`)
  removed += m
  if (m && !checkOnly) writeFileSync(pp, JSON.stringify(p, null, 2) + '\n')
}

await jsonDir(join(DATA, 'problems'))
await jsonDir(join(DATA, 'varieties'))
await markdownDir(join(DATA, 'content', 'crops'))
await companionsAndPrices()
console.log(`\n${kept} live sources kept, ${removed} dead removed (${cache.size} unique URLs checked)`)
if (checkOnly && removed > 0) process.exit(1)
