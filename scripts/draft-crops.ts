// Draft crop rules for the PRD §8.1 additions (60 → 90). Grounded research on
// Dutch sources, structured into the crop schema, linted, written with
// `verified: false`. Timing stays a draft until a grower checks ≥2 sources —
// the launch snapshot refuses drafts; beta snapshots ship them flagged.
//
//   npx tsx scripts/draft-crops.ts            # all missing
//   npx tsx scripts/draft-crops.ts mizuna     # one
import { existsSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { research, structure } from './gemini.ts'
import { lintCrop } from '../src/timing/lint.ts'
import type { Crop } from '../src/timing/types.ts'

const here = dirname(fileURLToPath(import.meta.url))
const DIR = join(here, '..', 'data', 'crops')

// [slug, nl, en, category]
const NEW: [string, string, string, string][] = [
  ['mizuna', 'Mizuna', 'Mizuna', 'leafy'], ['tatsoi', 'Tatsoi', 'Tatsoi', 'leafy'], ['komatsuna', 'Komatsuna', 'Komatsuna', 'leafy'],
  ['mustard-greens', 'Bladmosterd', 'Mustard greens', 'leafy'], ['purslane', 'Postelein', 'Summer purslane', 'leafy'],
  ['winter-purslane', 'Winterpostelein', 'Winter purslane (miner\'s lettuce)', 'leafy'], ['radicchio', 'Radicchio (roodlof)', 'Radicchio', 'leafy'],
  ['garden-cress', 'Tuinkers', 'Garden cress', 'leafy'], ['pea-shoots', 'Erwtenscheuten', 'Pea shoots', 'leafy'], ['wild-rocket', 'Wilde rucola', 'Wild rocket', 'leafy'],
  ['edamame', 'Edamame (sojaboon)', 'Edamame', 'legume'], ['celery-leaf', 'Snijselderij', 'Leaf celery', 'herb'],
  ['blueberry-in-pot', 'Blauwe bes in pot', 'Blueberry in a pot', 'fruit'], ['raspberry-in-pot', 'Framboos in pot', 'Raspberry in a pot', 'fruit'],
  ['fig-in-pot', 'Vijg in pot', 'Fig in a pot', 'fruit'], ['redcurrant-in-pot', 'Rode bes in pot', 'Redcurrant in a pot', 'fruit'],
  ['gooseberry-in-pot', 'Kruisbes in pot', 'Gooseberry in a pot', 'fruit'],
  ['lemon-balm', 'Citroenmelisse', 'Lemon balm', 'herb'], ['tarragon', 'Dragon', 'Tarragon', 'herb'], ['lovage', 'Lavas (maggiplant)', 'Lovage', 'herb'],
  ['chervil', 'Kervel', 'Chervil', 'herb'], ['summer-savory', 'Bonenkruid', 'Summer savory', 'herb'], ['borage', 'Bernagie (komkommerkruid)', 'Borage', 'herb'],
  ['nasturtium', 'Oost-Indische kers', 'Nasturtium', 'herb'], ['chamomile', 'Kamille', 'Chamomile', 'herb'], ['stevia', 'Stevia', 'Stevia', 'herb'],
  ['lemongrass', 'Citroengras', 'Lemongrass', 'herb'], ['marjoram', 'Marjolein', 'Marjoram', 'herb'], ['lemon-verbena', 'Citroenverbena', 'Lemon verbena', 'herb'],
  ['lavender', 'Lavendel (eetbaar)', 'Lavender (culinary)', 'herb'],
]

const wanted = process.argv.slice(2)
for (const [slug, nl, en, category] of NEW) {
  if (wanted.length && !wanted.includes(slug)) continue
  const path = join(DIR, `${slug}.json`)
  if (existsSync(path)) { console.log(`exists: ${slug}`); continue }
  const r = await research(`Search the web for Dutch and Belgian gardening pages (tuinadvies.nl, velt.nu, groei.nl, makkelijkemoestuin.nl, zaaikalender.nl, sluisgarden.nl, vreeken.nl) about growing ${nl} (${en}) in pots or a small garden in the Netherlands. Find: whether it is frost tender; when to sow indoors, sow direct, plant out or plant (as calendar months, and relative to the last spring frost / IJsheiligen or the first autumn frost); minimum soil temperature; spacing in cm; smallest sensible pot in litres; sun (full, partial, shade-tolerant); days from sowing or planting to first harvest; germination days; days from indoor sowing to planting out; feeding interval; sowing depth in mm; whether it is perennial. Cite the URL for each point.`)
  if (r.sources.length === 0) { console.log(`no grounding for ${slug}; skipped`); continue }
  const c = await structure<Omit<Crop, 'slug' | 'names' | 'category' | 'sources' | 'verified' | 'image' | 'water_cadence_days'>>(`Crop rule JSON for the Cropsy timing engine. Windows are FROST-RELATIVE: anchor "last_frost" (NL average ≈ 15 April, IJsheiligen ≈ mid May = week +4) or "first_frost" (≈ 1 November); start_weeks/end_weeks are week offsets from the anchor (negative = before). A frost-tender crop must never sow_direct or transplant before last_frost week 0. Use "plant" for tubers, sets, crowns, bought shrubs. JSON: {"frost_tender": bool, "container_ok": bool, "min_pot_litres": number|null, "spacing_cm": number, "vak_per_m2": number|null (plants per 30x30 cm), "sun": "full"|"partial"|"shade-tolerant", "methods": 1-3 of {"type": "sow_indoor"|"sow_direct"|"transplant"|"plant", "anchor": "last_frost"|"first_frost", "start_weeks": n, "end_weeks": n, "min_soil_c": number|null, "note": {"nl": short why, "en": same}}, "harvest": {"days_min": n, "days_max": n} counted from the outdoor start (transplant for indoor-started crops), "difficulty": 1|2|3, "feed_cadence_days": number|null, "depth_mm": number|null, "germination_days": number|null, "days_to_transplant": number|null, "perennial": bool}.`, r.text)
  const crop: Crop = { slug, names: { nl, en }, category, ...c, water_cadence_days: null, image: null, sources: r.sources, verified: false }
  const errors = lintCrop(crop).filter((i) => i.level === 'error')
  if (errors.length) { console.log(`lint errors for ${slug}: ${errors.map((e) => e.message).join('; ')} — not written`); continue }
  writeFileSync(path, JSON.stringify(crop, null, 2) + '\n')
  console.log(`draft: ${slug} (${crop.methods.map((m) => m.type).join('/')}, ${r.sources.length} sources)`)
}
