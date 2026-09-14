// Content drafting (PRD §8.1, Phase 3). Gemini with Google-Search grounding
// writes DRAFTS (`verified: false`, grounded source URLs attached). Nothing
// here reaches the snapshot until a person reviews and flips `verified`.
//
//   npx tsx scripts/draft-content.ts problems            # 25 NL balcony problems
//   npx tsx scripts/draft-content.ts varieties tomato …  # ~3 per crop, NL suppliers
//   npx tsx scripts/draft-content.ts companions          # good/bad pairs for all crops
//   npx tsx scripts/draft-content.ts editorial tomato nl # how-tos, FAQ, benefits
//   npx tsx scripts/draft-content.ts prices              # €/kg or €/piece NL average
// Re-running overwrites drafts only; verified files are left alone.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { askJson } from './gemini.ts'
import type { Companions, Problem, Variety } from '../src/content/types.ts'
import type { Price } from '../src/content/snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data')
const crops = loadCrops()
const [cmd, ...args] = process.argv.slice(2)

function writeDraft(path: string, value: unknown): void {
  if (existsSync(path)) {
    const cur = JSON.parse(readFileSync(path, 'utf8'))
    const verified = Array.isArray(cur) ? cur.some((r) => r.verified) : cur.verified
    if (verified) {
      console.log(`skip (verified): ${path}`)
      return
    }
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n')
  console.log(`draft: ${path}`)
}

const cropList = crops.map((c) => `${c.slug} (${c.names.nl} / ${c.names.en})`).join(', ')

async function problems(): Promise<void> {
  const { data, sources } = await askJson<Omit<Problem, 'sources' | 'verified' | 'image'>[]>(`
You are writing for a Dutch balcony / small-garden vegetable app. List the 25 most common plant problems
(pests, diseases, disorders) for container-grown vegetables and herbs in the Netherlands and Belgium.
Use Dutch horticultural sources (Tuinadvies, Groei & Bloei, Velt, Makkelijke Moestuin, IVN, Wageningen).
Return ONLY a JSON array. Each item: {"slug": kebab-case English id, "names": {"nl": "...", "en": "..."},
"kind": "pest"|"disease"|"disorder", "parts": subset of ["whole","leaves","stems","flowers","fruits","roots"],
"symptoms": {"nl": 2 sentences, "en": 2 sentences}, "treatment": {"nl": organic-first, 2-3 sentences, "en": same},
"prevention": {"nl": 1-2 sentences, "en": same}, "affects": array of crop slugs from this list only: ${cropList}, "sources": 1-3 URLs of the Dutch pages you used}.
Examples to include: slakken, bladluis, meeldauw, neusrot (blossom end rot), witte vlieg, spint, phytophthora, koolwitje.`)
  for (const p of data as (typeof data[number] & { sources?: string[] })[]) {
    writeDraft(join(DATA, 'problems', `${p.slug}.json`), { ...p, image: null, sources: [...new Set([...(p.sources ?? []), ...sources])], verified: false })
  }
}

async function varieties(slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    const crop = crops.find((c) => c.slug === slug)
    if (!crop) { console.log(`unknown crop ${slug}`); continue }
    const { data, sources } = await askJson<Omit<Variety, 'sources' | 'verified' | 'crop_slug'>[]>(`
List 3 to 4 vegetable/herb VARIETIES of ${crop.names.en} (Dutch: ${crop.names.nl}) that Dutch seed houses actually sell
(Sluis Garden, Buzzy, Vreeken's Zaden, Bakker, De Bolster, Welkoop, Intratuin). Prefer varieties suited to pots and balconies.
Return ONLY a JSON array: {"slug": "${slug}-<variety-kebab>", "names": {"nl": "...", "en": "..."},
"days_to_harvest": {"min": n, "max": n} or null, "container_ok": bool, "suppliers": [names], "traits": ["cherry","bush","early","mildew-resistant",...], "sources": [URLs of the supplier pages]}.`)
    writeDraft(join(DATA, 'varieties', `${slug}.json`), (data as (typeof data[number] & { sources?: string[] })[]).map((v) => ({ ...v, crop_slug: slug, sources: [...new Set([...(v.sources ?? []), ...sources])], verified: false })))
  }
}

async function companions(): Promise<void> {
  const { data, sources } = await askJson<Companions>(`
Companion planting for these crops (use slugs exactly): ${cropList}.
Only pairs with a practical, documented reason (pest deterrence, shade, nutrient use), from Dutch/Belgian sources
(Velt, Tuinadvies, Groei & Bloei, Makkelijke Moestuin). A pair may appear in good OR bad, never both.
Return ONLY JSON: {"good": [{"a": slug, "b": slug, "reason": {"nl": "...", "en": "..."}, "source": "url"}], "bad": [...]}. Aim for 40-60 good and 20-30 bad pairs.`)
  const key = (a: string, b: string) => [a, b].sort().join('|')
  const good = new Set(data.good.map((p) => key(p.a, p.b)))
  data.bad = data.bad.filter((p) => !good.has(key(p.a, p.b)))
  const path = join(DATA, 'companions.json')
  const cur = JSON.parse(readFileSync(path, 'utf8')) as Companions
  if (cur.good.length || cur.bad.length) { console.log('companions.json already has rows; not overwriting. Sources:', sources.join(' ')); return }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
  console.log(`draft: ${path} (${data.good.length} good, ${data.bad.length} bad) — sources: ${sources.join(' ')}`)
}

async function editorial(slug: string, lang: 'nl' | 'en'): Promise<void> {
  const crop = crops.find((c) => c.slug === slug)
  if (!crop) { console.log(`unknown crop ${slug}`); return }
  const path = join(DATA, 'content', 'crops', `${slug}.${lang}.md`)
  if (existsSync(path) && /^verified:\s*true/m.test(readFileSync(path, 'utf8'))) { console.log(`skip (verified): ${path}`); return }
  const { data, sources: grounded } = await askJson<{ starting: string; seedling: string; vegetative: string; flowering: string; harvest: string; faq: { q: string; a: string }[]; benefits: string; sources?: string[] }>(`
Write ${lang === 'nl' ? 'Dutch' : 'English'} growing guidance for ${crop.names.en} (${crop.names.nl}) on a Dutch balcony or small garden,
container-first, metric, Celsius, using IJsheiligen (11-15 May) as the frost-safe marker. Ground it in Dutch sources
(Tuinadvies, Groei & Bloei, Velt, Makkelijke Moestuin, IVN). Warm, short sentences, no fluff. Do not repeat numbers we
already hold as data (spacing ${crop.spacing_cm} cm, depth ${crop.depth_mm ?? '?'} mm, germination ${crop.germination_days ?? '?'} days).
Return ONLY JSON: {"starting": 80-120 words, "seedling": 60-90, "vegetative": 80-120, "flowering": 60-90, "harvest": 80-120,
"faq": 8 to 10 items {"q","a" 40-80 words}, "benefits": 60-90 words on kitchen use and nutrition (no health claims), "sources": 2-5 URLs of the Dutch pages you used}.`)
  const sources = [...new Set([...(data.sources ?? []), ...grounded])]
  const md = `---
crop: ${slug}
lang: ${lang}
verified: false
sources:
${sources.map((s) => `  - ${s}`).join('\n')}
---
## Starting
${data.starting}

## Seedling
${data.seedling}

## Vegetative
${data.vegetative}

## Flowering
${data.flowering}

## Harvest
${data.harvest}

## FAQ
${data.faq.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## Benefits
${data.benefits}
`
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, md)
  console.log(`draft: ${path}`)
}

async function prices(): Promise<void> {
  const { data, sources } = await askJson<Price[]>(`
Average 2025/2026 Dutch supermarket price (Albert Heijn / Jumbo, regular, not organic) for each crop as harvested:
${cropList}. Use €/kg for things sold by weight, €/piece ("pcs") for lettuce heads, courgettes, cucumbers, pumpkins, herbs (per bunch/pot).
Return ONLY a JSON array: {"crop_slug": slug, "eur": number, "unit": "kg"|"pcs", "source": URL of the shop page}.`)
  const path = join(DATA, 'content', 'prices.json')
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
  console.log(`draft: ${path} (${data.length} rows) — sources: ${sources.join(' ')}`)
  console.log('NOTE: prices carry no verified flag; review the file before committing.')
}

switch (cmd) {
  case 'problems': await problems(); break
  case 'varieties': await varieties(args.length ? args : crops.map((c) => c.slug)); break
  case 'companions': await companions(); break
  case 'editorial': await editorial(args[0]!, (args[1] as 'nl' | 'en') ?? 'nl'); break
  case 'prices': await prices(); break
  default:
    console.log('usage: draft-content.ts problems | varieties [slugs] | companions | editorial <slug> <nl|en> | prices')
}
