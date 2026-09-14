// Content drafting (PRD §8.1, Phase 3). Per item: one grounded research call
// (Google Search, Dutch sources) + one structuring call. Drafts are written
// with `verified: false` and the resolved source URLs. Nothing reaches the
// snapshot until a person reviews and flips `verified`.
//
//   npx tsx scripts/draft-content.ts problems            # 25 NL balcony problems
//   npx tsx scripts/draft-content.ts varieties [slugs]   # ~3 per crop, NL suppliers
//   npx tsx scripts/draft-content.ts companions [slugs]  # good/bad pairs per crop
//   npx tsx scripts/draft-content.ts editorial <slug> <nl|en>
//   npx tsx scripts/draft-content.ts prices [slugs]      # €/kg or €/piece, NL shops
// Re-running overwrites drafts only; verified files are left alone.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadCrops } from './loadCrops.ts'
import { research, structure } from './gemini.ts'
import type { Companions, Problem, Variety } from '../src/content/types.ts'
import type { Price } from '../src/content/snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DATA = join(here, '..', 'data')
const crops = loadCrops()
const [cmd, ...args] = process.argv.slice(2)
const slugList = crops.map((c) => c.slug).join(', ')
const cropOf = (slug: string) => {
  const c = crops.find((c) => c.slug === slug)
  if (!c) throw new Error(`unknown crop ${slug}`)
  return c
}

function isVerified(path: string): boolean {
  if (!existsSync(path)) return false
  if (path.endsWith('.md')) return /^verified:\s*true/m.test(readFileSync(path, 'utf8'))
  const cur = JSON.parse(readFileSync(path, 'utf8'))
  return Array.isArray(cur) ? cur.some((r) => r.verified) : !!cur.verified
}

function write(path: string, value: string | object): void {
  if (isVerified(path)) { console.log(`skip (verified): ${path}`); return }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
  console.log(`draft: ${path}`)
}

// ── problems ────────────────────────────────────────────────────────────────
const PROBLEMS: [slug: string, nl: string, en: string][] = [
  ['slugs-and-snails', 'Slakken', 'Slugs and snails'], ['aphids', 'Bladluis', 'Aphids'], ['powdery-mildew', 'Echte meeldauw', 'Powdery mildew'],
  ['downy-mildew', 'Valse meeldauw', 'Downy mildew'], ['blossom-end-rot', 'Neusrot', 'Blossom end rot'], ['whitefly', 'Witte vlieg', 'Whitefly'],
  ['spider-mites', 'Spint', 'Spider mites'], ['late-blight', 'Aardappelziekte (Phytophthora)', 'Late blight'], ['cabbage-white-caterpillar', 'Koolwitje (rupsen)', 'Cabbage white caterpillars'],
  ['carrot-fly', 'Wortelvlieg', 'Carrot fly'], ['cabbage-root-fly', 'Koolvlieg', 'Cabbage root fly'], ['leek-moth', 'Preimot', 'Leek moth'],
  ['flea-beetles', 'Aardvlooien', 'Flea beetles'], ['thrips', 'Trips', 'Thrips'], ['leaf-miner', 'Mineervlieg', 'Leaf miner'],
  ['fungus-gnats', 'Rouwvliegjes', 'Fungus gnats'], ['damping-off', 'Omvalziekte (kiemschimmel)', 'Damping off'], ['grey-mould', 'Grauwe schimmel (Botrytis)', 'Grey mould'],
  ['allium-rust', 'Roest bij ui en prei', 'Allium rust'], ['root-rot', 'Wortelrot door natte voeten', 'Root rot (waterlogging)'], ['sunscald', 'Zonnebrand', 'Sunscald'],
  ['nitrogen-deficiency', 'Stikstofgebrek', 'Nitrogen deficiency'], ['magnesium-deficiency', 'Magnesiumgebrek', 'Magnesium deficiency'], ['bolting', 'Doorschieten', 'Bolting'],
  ['fruit-cracking', 'Barsten van vruchten', 'Fruit cracking'],
]

async function problems(): Promise<void> {
  for (const [slug, nl, en] of PROBLEMS) {
    const path = join(DATA, 'problems', `${slug}.json`)
    if (isVerified(path)) { console.log(`skip (verified): ${path}`); continue }
    const r = await research(`Search the web for Dutch and Belgian gardening pages (tuinadvies.nl, velt.nu, groei.nl, makkelijkemoestuin.nl, ivn.nl, wur.nl) about "${nl}" (${en}) on vegetables and herbs grown in pots on a balcony or in a small garden. Summarize: how to recognise it (symptoms), which plant parts, organic control, prevention, and which crops it affects. Cite the URL for each point.`)
    if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); continue }
    const p = await structure<Omit<Problem, 'sources' | 'verified' | 'image' | 'slug'>>(`Write a JSON object for a Dutch balcony-gardening app: {"names": {"nl": "${nl}", "en": "${en}"}, "kind": "pest"|"disease"|"disorder", "parts": subset of ["whole","leaves","stems","flowers","fruits","roots"], "symptoms": {"nl": 2 sentences, "en": 2 sentences}, "treatment": {"nl": organic-first 2-3 sentences, "en": same}, "prevention": {"nl": 1-2 sentences, "en": same}, "affects": crop slugs from this list only: ${slugList}}.`, r.text)
    write(path, { slug, ...p, image: null, sources: r.sources, verified: false })
  }
}

// ── varieties ───────────────────────────────────────────────────────────────
async function varieties(slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    const crop = cropOf(slug)
    const path = join(DATA, 'varieties', `${slug}.json`)
    if (isVerified(path)) { console.log(`skip (verified): ${path}`); continue }
    const r = await research(`Search the web for Dutch seed houses and garden centres (Sluis Garden, Buzzy, Vreeken's Zaden, De Bolster, Bakker, Welkoop, Intratuin) selling varieties of ${crop.names.nl} (${crop.names.en}). List 3 to 4 varieties suited to pots or a balcony, with days to harvest, traits (cherry, bush, early, resistant …) and supplier. Cite the product page URL for each variety.`)
    if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); continue }
    const rows = await structure<Omit<Variety, 'sources' | 'verified' | 'crop_slug'>[]>(`JSON array of 3-4 varieties: {"slug": "${slug}-<variety-kebab>", "names": {"nl": "...", "en": "..."}, "days_to_harvest": {"min": n, "max": n} or null, "container_ok": bool, "suppliers": [names], "traits": ["cherry","bush","early","mildew-resistant",...]}.`, r.text)
    write(path, rows.map((v) => ({ ...v, crop_slug: slug, sources: r.sources, verified: false })))
  }
}

// ── companions ──────────────────────────────────────────────────────────────
async function companions(slugs: string[]): Promise<void> {
  const path = join(DATA, 'companions.json')
  const all = JSON.parse(readFileSync(path, 'utf8')) as Companions
  const key = (a: string, b: string) => [a, b].sort().join('|')
  const seen = new Set([...all.good, ...all.bad].map((p) => key(p.a, p.b)))
  for (const slug of slugs) {
    const crop = cropOf(slug)
    const r = await research(`Search the web for Dutch and Belgian companion-planting pages (velt.nu, tuinadvies.nl, makkelijkemoestuin.nl, groei.nl) about ${crop.names.nl} (${crop.names.en}). Which vegetables and herbs are good and bad neighbours of it in a small garden or planter, and why? Cite the URL for each point.`)
    if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); continue }
    const pairs = await structure<{ good: { b: string; reason: { nl: string; en: string } }[]; bad: { b: string; reason: { nl: string; en: string } }[] }>(`Partner "${slug}" with other crops. Use slugs from this list only: ${slugList}. Only pairs the notes support with a practical reason. JSON: {"good": [{"b": slug, "reason": {"nl": "...", "en": "..."}}], "bad": [...]}.`, r.text)
    const src = r.sources[0]!
    for (const p of pairs.good) if (crops.some((c) => c.slug === p.b) && !seen.has(key(slug, p.b))) { all.good.push({ a: slug, b: p.b, reason: p.reason, source: src }); seen.add(key(slug, p.b)) }
    for (const p of pairs.bad) if (crops.some((c) => c.slug === p.b) && !seen.has(key(slug, p.b))) { all.bad.push({ a: slug, b: p.b, reason: p.reason, source: src }); seen.add(key(slug, p.b)) }
    console.log(`${slug}: +${pairs.good.length} good, +${pairs.bad.length} bad`)
  }
  writeFileSync(path, JSON.stringify(all, null, 2) + '\n')
  console.log(`companions.json: ${all.good.length} good, ${all.bad.length} bad`)
}

// ── editorial ───────────────────────────────────────────────────────────────
async function editorial(slug: string, lang: 'nl' | 'en'): Promise<void> {
  const crop = cropOf(slug)
  const path = join(DATA, 'content', 'crops', `${slug}.${lang}.md`)
  if (isVerified(path)) { console.log(`skip (verified): ${path}`); return }
  const r = await research(`Search the web for Dutch and Belgian gardening pages (tuinadvies.nl, velt.nu, groei.nl, makkelijkemoestuin.nl, ivn.nl) about growing ${crop.names.nl} (${crop.names.en}) in containers or a small garden in the Netherlands. Summarize what they say about sowing/starting, seedlings and pricking out, the growing phase (pot size, watering, feeding, support), flowering and fruit set, harvest and storage, common questions and problems, and kitchen use. Metric units, Celsius, IJsheiligen as the frost marker. Cite the URL for each point.`)
  if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); return }
  const d = await structure<{ starting: string; seedling: string; vegetative: string; flowering: string; harvest: string; faq: { q: string; a: string }[]; benefits: string }>(`Write ${lang === 'nl' ? 'Dutch' : 'English'} growing guidance for ${crop.names.en} on a Dutch balcony or small garden, container-first. Warm, short sentences, no fluff, no health claims. Do not repeat numbers we hold as data (spacing ${crop.spacing_cm} cm, depth ${crop.depth_mm ?? '?'} mm). JSON: {"starting": 80-120 words, "seedling": 60-90, "vegetative": 80-120, "flowering": 60-90, "harvest": 80-120, "faq": 8-10 items {"q","a" 40-80 words}, "benefits": 60-90 words on kitchen use}.`, r.text)
  write(path, `---
crop: ${slug}
lang: ${lang}
verified: false
sources:
${r.sources.map((s) => `  - ${s}`).join('\n')}
---
## Starting
${d.starting}

## Seedling
${d.seedling}

## Vegetative
${d.vegetative}

## Flowering
${d.flowering}

## Harvest
${d.harvest}

## FAQ
${d.faq.map((f) => `### ${f.q}\n${f.a}`).join('\n\n')}

## Benefits
${d.benefits}
`)
}

// ── prices ──────────────────────────────────────────────────────────────────
async function prices(slugs: string[]): Promise<void> {
  const path = join(DATA, 'content', 'prices.json')
  const cur = (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : []) as Price[]
  const byslug = new Map(cur.map((p) => [p.crop_slug, p]))
  for (const slug of slugs) {
    const crop = cropOf(slug)
    const r = await research(`Search the web for the current price of fresh ${crop.names.nl} (${crop.names.en}, regular, not organic) at Albert Heijn or Jumbo in the Netherlands. Give the price per kilo, or per piece/bunch/head if sold that way. Cite the product page URL.`)
    if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); continue }
    const p = await structure<{ eur: number; unit: 'kg' | 'pcs' }>(`JSON {"eur": number, "unit": "kg"|"pcs"} for ${crop.names.en}. "pcs" = sold per piece/bunch/head.`, r.text)
    if (!(p.eur > 0)) { console.log(`${slug}: no shop price found; skipped`); continue }
    byslug.set(slug, { crop_slug: slug, eur: p.eur, unit: p.unit, source: r.sources[0] })
    console.log(`${slug}: €${p.eur}/${p.unit}`)
  }
  writeFileSync(path, JSON.stringify([...byslug.values()].sort((a, b) => a.crop_slug.localeCompare(b.crop_slug)), null, 2) + '\n')
}

const allSlugs = crops.map((c) => c.slug)
switch (cmd) {
  case 'problems': await problems(); break
  case 'varieties': await varieties(args.length ? args : allSlugs); break
  case 'companions': await companions(args.length ? args : allSlugs); break
  case 'editorial': await editorial(args[0]!, (args[1] as 'nl' | 'en') ?? 'nl'); break
  case 'prices': await prices(args.length ? args : allSlugs); break
  default:
    console.log('usage: draft-content.ts problems | varieties [slugs] | companions [slugs] | editorial <slug> <nl|en> | prices [slugs]')
}
