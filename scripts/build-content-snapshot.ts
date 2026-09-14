// CLI: write generated/content-snapshot.json from data/content/*.json.
// Committed for the same reason as crops-snapshot (see build-snapshot.ts).
//
//   npm run snapshot                              # launch build: drafts stripped
//   CONTENT_INCLUDE_DRAFTS=1 npm run snapshot     # beta build: drafts kept, flagged
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { buildContentSnapshot, type BuildOptions, type ContentData, type ContentSnapshot, type Guide } from '../src/content/snapshot.ts'

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

export const buildOptions: BuildOptions = { includeDrafts: process.env.CONTENT_INCLUDE_DRAFTS === '1' }

/** data/content/crops/<slug>.<lang>.md → Guide. Front-matter + ## sections. */
function readGuides(dir: string): Guide[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = readFileSync(join(dir, f), 'utf8')
      const fm = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
      if (!fm) throw new Error(`${f}: missing front-matter`)
      const [, head, body] = fm
      const field = (k: string) => head!.match(new RegExp(`^${k}:\\s*(.*)$`, 'm'))?.[1]?.trim()
      const sources = [...head!.matchAll(/^  - (\S+)$/gm)].map((m) => m[1]!)
      const sections = new Map<string, string>()
      for (const m of body!.matchAll(/^## (.+)\n([\s\S]*?)(?=^## |$(?![\r\n]))/gm)) sections.set(m[1]!.trim().toLowerCase(), m[2]!.trim())
      const faq = [...(sections.get('faq') ?? '').matchAll(/^### (.+)\n([\s\S]*?)(?=^### |$(?![\r\n]))/gm)].map((m) => ({ q: m[1]!.trim(), a: m[2]!.trim() }))
      const need = (k: string) => {
        const v = sections.get(k)
        if (v === undefined) throw new Error(`${f}: missing ## ${k}`)
        return v
      }
      return {
        crop_slug: field('crop')!,
        lang: field('lang') as 'nl' | 'en',
        starting: need('starting'),
        seedling: need('seedling'),
        vegetative: need('vegetative'),
        flowering: need('flowering'),
        harvest: need('harvest'),
        faq,
        benefits: need('benefits'),
        sources,
        verified: field('verified') === 'true',
      }
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
    guides: readGuides(join(DATA, 'crops')),
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) main()

function main() {
const snapshot = buildContentSnapshot(loadContent(), new Date(), buildOptions)
const existing: ContentSnapshot | null = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null
if (existing?.version === snapshot.version) {
  console.log(`Content snapshot unchanged (${snapshot.version})`)
} else {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`Content snapshot written: ${snapshot.version}`)
}
}
