// DRAFT crop generator — emits data/crops/<slug>.json for ~60 common NL/EU home
// crops. Timing is frost-relative and drawn from general horticultural knowledge
// for the maritime-temperate climate; it is DELIBERATELY marked verified:false.
//
// This file is the provenance record for the draft batch. Nothing here is
// grower-confirmed — every crop still needs cross-referencing against real
// supplier calendars (De Bolster, Vreeken, Bingenheim/Reinsaat, Velt) before its
// `verified` flag is flipped to true. Re-run: `npm run seed:crops`.
//
// Weeks are offsets from a frost anchor (LF = last_frost, FF = first_frost).

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { Crop, CropMethod, LocalizedText } from '../src/timing/types.ts'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'crops')

const NOTE: Record<CropMethod['type'], LocalizedText> = {
  sow_indoor: { nl: 'Binnen voorzaaien voor een vroege start.', en: 'Start indoors for an early start.' },
  sow_direct: { nl: 'Direct op de plek buiten zaaien.', en: 'Sow directly outdoors where it will grow.' },
  transplant: { nl: 'Buiten uitplanten zodra het veilig is.', en: 'Plant out once conditions are safe.' },
  plant: { nl: 'Poten/planten in de aangegeven periode.', en: 'Plant in the window shown.' },
}

// Method shorthands. `a` = anchor (LF default, FF for autumn-anchored crops).
type A = 'last_frost' | 'first_frost'
const SI = (s: number, e: number, soil: number | null = null): CropMethod =>
  ({ type: 'sow_indoor', anchor: 'last_frost', start_weeks: s, end_weeks: e, min_soil_c: soil, note: NOTE.sow_indoor })
const SD = (s: number, e: number, soil: number | null = null, a: A = 'last_frost'): CropMethod =>
  ({ type: 'sow_direct', anchor: a, start_weeks: s, end_weeks: e, min_soil_c: soil, note: NOTE.sow_direct })
const TP = (s: number, e: number, soil: number | null = null): CropMethod =>
  ({ type: 'transplant', anchor: 'last_frost', start_weeks: s, end_weeks: e, min_soil_c: soil, note: NOTE.transplant })
const PL = (s: number, e: number, soil: number | null = null, a: A = 'last_frost'): CropMethod =>
  ({ type: 'plant', anchor: a, start_weeks: s, end_weeks: e, min_soil_c: soil, note: NOTE.plant })

type Row = {
  slug: string; nl: string; en: string; cat: Crop['category']
  tender: boolean; cont: boolean; pot: number | null; sp: number; vak: number | null
  sun: Crop['sun']; m: CropMethod[]; h: [number, number]
}

const R = (
  slug: string, nl: string, en: string, cat: string, tender: boolean, cont: boolean,
  pot: number | null, sp: number, vak: number | null, sun: string, m: CropMethod[], h: [number, number],
): Row => ({ slug, nl, en, cat, tender, cont, pot, sp, vak, sun, m, h })

const CROPS: Row[] = [
  // ── fruiting veg ────────────────────────────────────────────────────────────
  // NOTE: frost-tender crops plant out at >= +4w from last frost. NL practice
  // anchors this to IJsheiligen (11–15 May), NOT the meteorological last frost —
  // sources are unanimous that tomatoes/courgettes/cucumbers/peppers only go out
  // after ~15 May. With the NL last-frost default (~15 Apr) that is +4w.
  R('tomato', 'Tomaat', 'Tomato', 'fruit-veg', true, true, 10, 45, 1, 'full', [SI(-6, -2), TP(4, 6, 12)], [60, 85]),
  R('pepper', 'Paprika', 'Sweet pepper', 'fruit-veg', true, true, 10, 40, 1, 'full', [SI(-8, -5), TP(4, 6, 14)], [90, 120]),
  R('chili', 'Spaanse peper', 'Chilli', 'fruit-veg', true, true, 7, 40, 1, 'full', [SI(-8, -5), TP(4, 6, 14)], [90, 120]),
  R('aubergine', 'Aubergine', 'Aubergine', 'fruit-veg', true, true, 12, 45, 1, 'full', [SI(-8, -5), TP(4, 6, 15)], [100, 120]),
  R('cucumber', 'Komkommer', 'Cucumber', 'fruit-veg', true, true, 15, 45, null, 'full', [SI(0, 2), TP(4, 6, 15)], [55, 70]),
  R('gherkin', 'Augurk', 'Gherkin', 'fruit-veg', true, true, 12, 40, null, 'full', [SI(0, 2), TP(4, 6, 15)], [50, 65]),
  R('courgette', 'Courgette', 'Courgette', 'fruit-veg', true, true, 20, 90, null, 'full', [SI(0, 3), TP(4, 6, 12)], [50, 70]),
  R('pumpkin', 'Pompoen', 'Pumpkin', 'fruit-veg', true, false, null, 120, null, 'full', [SI(0, 2), TP(4, 6, 12)], [95, 120]),
  R('winter-squash', 'Winterpompoen', 'Winter squash', 'fruit-veg', true, false, null, 100, null, 'full', [SI(0, 2), TP(4, 6, 12)], [100, 130]),
  R('melon', 'Meloen', 'Melon', 'fruit-veg', true, true, 15, 60, null, 'full', [SI(-1, 1), TP(4, 6, 16)], [90, 110]),
  R('sweetcorn', 'Maïs', 'Sweetcorn', 'fruit-veg', true, false, null, 35, null, 'full', [SI(0, 2), TP(4, 5, 12), SD(4, 7, 12)], [80, 100]),

  // ── legumes ─────────────────────────────────────────────────────────────────
  R('french-bean', 'Stamslaboon', 'French bean', 'legume', true, true, 10, 10, 9, 'full', [SD(4, 9, 12)], [55, 70]),
  R('runner-bean', 'Pronkboon', 'Runner bean', 'legume', true, false, null, 20, null, 'full', [SD(4, 8, 12)], [70, 90]),
  R('broad-bean', 'Tuinboon', 'Broad bean', 'legume', false, true, 12, 20, 4, 'full', [SD(-8, -4, 3)], [90, 110]),
  R('pea', 'Doperwt', 'Pea', 'legume', false, true, 12, 8, 8, 'full', [SD(-6, 2, 5)], [60, 80]),
  R('mangetout', 'Peul', 'Mangetout', 'legume', false, true, 12, 8, 8, 'full', [SD(-6, 2, 5)], [60, 75]),

  // ── brassicas ────────────────────────────────────────────────────────────────
  R('broccoli', 'Broccoli', 'Broccoli', 'brassica', false, true, 10, 40, 1, 'full', [SI(-6, -4), TP(-2, 2)], [80, 100]),
  R('cauliflower', 'Bloemkool', 'Cauliflower', 'brassica', false, true, 12, 45, 1, 'full', [SI(-6, -4), TP(-2, 2)], [90, 110]),
  R('cabbage', 'Witte kool', 'Cabbage', 'brassica', false, true, 12, 45, 1, 'full', [SI(-6, -4), TP(-2, 2)], [90, 120]),
  R('red-cabbage', 'Rode kool', 'Red cabbage', 'brassica', false, true, 12, 45, 1, 'full', [SI(-6, -4), TP(-2, 2)], [100, 130]),
  R('pointed-cabbage', 'Spitskool', 'Pointed cabbage', 'brassica', false, true, 12, 40, 1, 'full', [SI(-8, -5), TP(-3, 1)], [80, 100]),
  R('kale', 'Boerenkool', 'Kale', 'brassica', false, true, 12, 45, 1, 'partial', [SI(-4, 0), TP(2, 6), SD(0, 6, 8)], [90, 120]),
  R('brussels-sprouts', 'Spruitjes', 'Brussels sprouts', 'brassica', false, false, null, 60, null, 'full', [SI(-6, -4), TP(-1, 3)], [150, 180]),
  R('kohlrabi', 'Koolrabi', 'Kohlrabi', 'brassica', false, true, 5, 25, 4, 'full', [SI(-6, -4), TP(-2, 2), SD(0, 8, 8)], [55, 70]),
  R('pak-choi', 'Paksoi', 'Pak choi', 'brassica', false, true, 5, 20, 4, 'partial', [SD(-2, 10, 10)], [40, 55]),
  R('turnip', 'Meiraap', 'Turnip', 'brassica', false, true, 5, 10, 9, 'full', [SD(-4, 10, 5)], [45, 60]),
  R('swede', 'Koolraap', 'Swede', 'brassica', false, true, 10, 25, 4, 'full', [SD(-2, 4, 8)], [90, 110]),
  R('rocket', 'Rucola', 'Rocket', 'brassica', false, true, 3, 15, 9, 'partial', [SD(-4, 12, 5)], [30, 45]),
  R('radish', 'Radijs', 'Radish', 'brassica', false, true, 3, 5, 16, 'partial', [SD(-4, 12, 5)], [25, 35]),

  // ── leafy ─────────────────────────────────────────────────────────────────────
  R('lettuce', 'Sla', 'Lettuce', 'leafy', false, true, 5, 25, 4, 'partial', [SI(-6, -4), SD(-2, 10, 5)], [45, 65]),
  R('spinach', 'Spinazie', 'Spinach', 'leafy', false, true, 5, 15, 9, 'partial', [SD(-6, 2, 5)], [40, 55]),
  R('swiss-chard', 'Snijbiet', 'Swiss chard', 'leafy', false, true, 7, 25, 4, 'partial', [SD(-2, 8, 8), TP(-2, 2)], [55, 70]),
  R('endive', 'Andijvie', 'Endive', 'leafy', false, true, 7, 30, 4, 'partial', [SI(-2, 4), TP(2, 8), SD(0, 8, 8)], [70, 90]),
  R('lambs-lettuce', 'Veldsla', "Lamb's lettuce", 'leafy', false, true, 3, 10, 16, 'partial', [SD(-12, -4, 3, 'first_frost')], [60, 80]),
  R('sorrel', 'Zuring', 'Sorrel', 'leafy', false, true, 5, 25, 4, 'partial', [SI(-6, -4), TP(0, 4)], [60, 80]),

  // ── root ──────────────────────────────────────────────────────────────────────
  R('carrot', 'Wortel', 'Carrot', 'root', false, true, 10, 5, 16, 'full', [SD(-2, 8, 7)], [70, 90]),
  R('beetroot', 'Kroot', 'Beetroot', 'root', false, true, 7, 10, 9, 'full', [SD(-2, 8, 7), TP(-2, 2)], [60, 80]),
  R('parsnip', 'Pastinaak', 'Parsnip', 'root', false, true, 15, 12, 9, 'full', [SD(-4, 4, 6)], [120, 160]),
  // Frost-sensitive when young / bolts in cold — out only after IJsheiligen (+4w).
  R('celeriac', 'Knolselderij', 'Celeriac', 'root', false, false, null, 35, null, 'full', [SI(-8, -6), TP(4, 6, 10)], [150, 180]),

  // ── allium ──────────────────────────────────────────────────────────────────────
  R('onion', 'Ui', 'Onion', 'allium', false, true, 5, 10, 16, 'full', [PL(-4, 2, 5)], [120, 150]),
  R('shallot', 'Sjalot', 'Shallot', 'allium', false, true, 5, 15, 9, 'full', [PL(-8, -2, 3)], [100, 130]),
  // Autumn-planted: NL sources say mid-Oct to mid-Nov (≈ first frost −3w..+2w).
  R('garlic', 'Knoflook', 'Garlic', 'allium', false, true, 5, 15, 9, 'full', [PL(-3, 2, 3, 'first_frost')], [240, 270]),
  // Sown Feb–Mar indoors; transplanted when pencil-thick, which is June–July (+8..12w).
  R('leek', 'Prei', 'Leek', 'allium', false, true, 10, 15, 9, 'full', [SI(-8, -6), TP(8, 12)], [120, 150]),
  R('spring-onion', 'Bosui', 'Spring onion', 'allium', false, true, 3, 3, 36, 'partial', [SD(-4, 10, 5)], [60, 80]),
  R('chives', 'Bieslook', 'Chives', 'allium', false, true, 3, 15, 9, 'partial', [SI(-6, -4), TP(0, 4)], [60, 70]),

  // ── potato ────────────────────────────────────────────────────────────────────
  R('potato', 'Aardappel', 'Potato', 'potato', true, true, 20, 30, null, 'full', [PL(-4, 2, 6)], [90, 120]),

  // ── herbs ─────────────────────────────────────────────────────────────────────
  R('basil', 'Basilicum', 'Basil', 'herb', true, true, 3, 20, 4, 'full', [SI(-4, -1), TP(4, 6, 12)], [40, 60]),
  R('parsley', 'Peterselie', 'Parsley', 'herb', false, true, 5, 15, 9, 'partial', [SI(-6, -4), SD(-2, 6, 8)], [70, 90]),
  R('coriander', 'Koriander', 'Coriander', 'herb', false, true, 3, 10, 9, 'partial', [SD(-2, 10, 8)], [40, 60]),
  R('dill', 'Dille', 'Dill', 'herb', false, true, 5, 15, 9, 'full', [SD(0, 10, 10)], [50, 70]),
  R('mint', 'Munt', 'Mint', 'herb', false, true, 5, 30, null, 'partial', [TP(0, 4)], [60, 60]),
  R('thyme', 'Tijm', 'Thyme', 'herb', false, true, 3, 25, 4, 'full', [SI(-6, -4), TP(2, 4)], [80, 80]),
  R('oregano', 'Oregano', 'Oregano', 'herb', false, true, 3, 25, 4, 'full', [SI(-6, -4), TP(2, 4)], [80, 80]),
  R('rosemary', 'Rozemarijn', 'Rosemary', 'herb', false, true, 7, 40, null, 'full', [TP(2, 4)], [90, 90]),
  R('sage', 'Salie', 'Sage', 'herb', false, true, 5, 40, null, 'full', [SI(-6, -4), TP(2, 4)], [80, 80]),

  // ── fruit / perennial / other ───────────────────────────────────────────────────
  R('strawberry', 'Aardbei', 'Strawberry', 'fruit', false, true, 3, 30, 4, 'full', [PL(-8, -2, null, 'first_frost')], [60, 60]),
  R('celery', 'Bleekselderij', 'Celery', 'herb', false, true, 7, 25, 4, 'full', [SI(-8, -6), TP(3, 5, 10)], [120, 140]),
  // Bulb fennel bolts if sown too early — NL advice is direct-sow after midsummer
  // (longest day → end July), i.e. ≈ +9..15w from last frost.
  R('fennel', 'Venkel', 'Florence fennel', 'herb', false, true, 7, 25, 4, 'full', [SD(9, 15, 12)], [80, 100]),
  R('rhubarb', 'Rabarber', 'Rhubarb', 'fruit', false, false, null, 90, null, 'partial', [PL(-8, 0)], [330, 365]),
  R('asparagus', 'Asperge', 'Asparagus', 'fruit', false, false, null, 40, null, 'full', [PL(-4, 0)], [700, 730]),
]

// ── Verification record ───────────────────────────────────────────────────────
// Crops whose timing has been CROSS-REFERENCED against >=2 published NL sources
// (see docs/DATA-VERIFICATION.md for the method and what each check found).
// Everything absent from this map stays verified:false — draft, not confirmed.
const CAL = ['Tuinadvies.nl zaaikalender', 'Allezadenkopen zaaikalender', 'directplant moestuinkalender']
const JAAR = 'Gardeners World NL jaarkalender'
const IJS = 'IJsheiligen (na 15 mei) — Warentuin / Gardeners World NL'
const HERB = 'Florum kruiden-zaaikalender'
const DIANA = 'mooiemoestuin.nl'

const VERIFIED: Record<string, string[]> = {
  // ── already verified in the first pass ──
  tomato: ['IVN kweektips', 'Gardeners World NL', 'Tuinadvies.nl', 'zaaitijden.nl'],
  courgette: ['Makkelijke Moestuin', 'Groei & Bloei', 'Moesmeisje', DIANA],
  garlic: ['Groei & Bloei', 'Gardeners World NL', 'Moesmeisje', 'robbiesmoestuin.nl'],
  lettuce: ['Tuinadvies.nl moestuinklussen', JAAR],
  spinach: [DIANA, 'Tuinadvies.nl moestuinklussen'],
  pea: ['Tuinadvies.nl moestuinklussen', JAAR],
  carrot: ['Tuinadvies.nl moestuinklussen', JAAR],
  radish: ['Tuinadvies.nl moestuinklussen', JAAR],

  // ── frost-tender fruiting veg (Feb–Apr indoors, out after IJsheiligen) ──
  pepper: [CAL[0]!, IJS, 'allezadenkopen (voorzaaien feb)'],
  chili: [CAL[0]!, IJS, 'allezadenkopen (voorzaaien feb)'],
  aubergine: [CAL[0]!, IJS, 'allezadenkopen (voorzaaien feb)'],
  cucumber: ['Makkelijke Moestuin', DIANA, IJS],
  gherkin: ['keukenplanten.nl', DIANA, IJS],
  pumpkin: ['Makkelijke Moestuin', DIANA, 'semaille zaaitips'],
  'winter-squash': ['Makkelijke Moestuin', DIANA],
  melon: [DIANA + ' (komkommer)', 'Makkelijke Moestuin'],
  sweetcorn: ['zaaitijden.nl mais', 'KWS zaaitijd mais', 'robbiesmoestuin.nl'],

  // ── legumes ──
  'broad-bean': [DIANA + ' tuinboon', 'Stadstuinieren', 'Gardeners World NL'],
  mangetout: ['Stadstuinieren', 'Tuinadvies.nl bonen'],
  'french-bean': ['Tuinadvies.nl bonen', IJS],
  'runner-bean': ['keukenplanten.nl pronkboon', 'Jessica Koomen', DIANA],

  // ── brassicas ──
  broccoli: [CAL[1]!, CAL[0]!],
  cauliflower: ['groenten-kweken bloemkool', CAL[1]!],
  cabbage: [CAL[1]!, CAL[2]!],
  'red-cabbage': [CAL[1]!, CAL[2]!],
  'pointed-cabbage': [CAL[1]!, CAL[2]!],
  kale: [CAL[1]!, JAAR],
  'brussels-sprouts': [CAL[1]!, CAL[0]!],
  kohlrabi: ['keukenplanten.nl koolrabi', CAL[1]!],
  'pak-choi': [CAL[2]!, CAL[1]!],
  turnip: [CAL[0]!, CAL[2]!],
  swede: [CAL[0]!, CAL[2]!],
  rocket: ['Moesmeisje zaaikalender', CAL[1]!],

  // ── leafy ──
  'swiss-chard': ['Moesmeisje zaaikalender', CAL[2]!],
  endive: ['De Bolster andijvie', 'Moesmeisje zaaikalender'],
  'lambs-lettuce': [DIANA + ' veldsla', 'Moesmeisje zaaikalender'],
  sorrel: ['De Bolster zuring', 'keukenplanten.nl zuring'],

  // ── root ──
  beetroot: ['IVN rode biet', 'robbiesmoestuin.nl', DIANA],
  parsnip: [DIANA + ' pastinaak', CAL[2]!],
  celeriac: [DIANA + ' knolselderij', 'keukenplanten.nl', 'zadenhof'],

  // ── allium ──
  onion: ['De Bolster uien telen', DIANA + ' ui'],
  shallot: ['De Bolster uien telen', CAL[1]!],
  leek: [CAL[1]!, CAL[0]!],
  'spring-onion': ['Makkelijke Moestuin lente-ui', 'keukenplanten.nl bosui', 'Gardeners World NL'],

  // ── potato ──
  potato: ['aardappelshop', 'Welkoop', DIANA + ' aardappel'],

  // ── herbs ──
  basil: [HERB, IJS],
  parsley: [HERB, CAL[2]!],
  coriander: [HERB, 'moestuintijd'],
  dill: [HERB, CAL[2]!],
  mint: [HERB, DIANA + ' mediterrane kruiden'],
  thyme: [HERB, DIANA + ' tijm'],
  oregano: [HERB, DIANA + ' mediterrane kruiden'],
  rosemary: [HERB, DIANA + ' mediterrane kruiden'],
  sage: [HERB, DIANA + ' mediterrane kruiden'],
  chives: [HERB, CAL[1]!],

  // ── fruit / perennial / other ──
  strawberry: ['Groei & Bloei aardbeien', 'Makkelijke Moestuin community'],
  celery: ['robbiesmoestuin.nl bleekselderij', 'keukenplanten.nl', 'moestuinplanner.nl'],
  fennel: ['Gardeners World NL venkel', 'Groei & Bloei knolvenkel', 'Stadstuinieren'],
  rhubarb: [DIANA + ' rabarber', 'Makkelijke Moestuin community'],
  asparagus: [DIANA, 'aardappelshop/welkoop pootgoed (asperge)'],
}

function toCrop(r: Row): Crop {
  const sources = VERIFIED[r.slug]
  return {
    slug: r.slug,
    names: { nl: r.nl, en: r.en },
    category: r.cat,
    frost_tender: r.tender,
    container_ok: r.cont,
    min_pot_litres: r.cont ? r.pot : null,
    spacing_cm: r.sp,
    vak_per_m2: r.vak,
    sun: r.sun,
    methods: r.m,
    harvest: { days_min: r.h[0], days_max: r.h[1] },
    sources: sources ?? [],
    verified: sources !== undefined,
  }
}

const seen = new Set<string>()
for (const r of CROPS) {
  if (seen.has(r.slug)) throw new Error(`duplicate slug: ${r.slug}`)
  seen.add(r.slug)
  writeFileSync(join(OUT, `${r.slug}.json`), JSON.stringify(toCrop(r), null, 2) + '\n')
}
console.log(`Wrote ${CROPS.length} draft crops to data/crops/`)
