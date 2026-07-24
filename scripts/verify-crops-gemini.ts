// Cross-reference our draft crop timing against published NL sources using Gemini
// WITH GOOGLE SEARCH GROUNDING. Grounding is the whole point: we want real, cited
// sources, not a second LLM guess. The script prints, per crop, Gemini's month
// windows AND the source URLs it grounded on, so we can spot-check them.
//
// Pilot mode by default (a few crops). Needs GEMINI_API_KEY in the environment.
//   GEMINI_API_KEY=... npx tsx scripts/verify-crops-gemini.ts tomato garlic courgette

import { loadCrops } from './loadCrops.ts'

const KEY = process.env.GEMINI_API_KEY
if (!KEY) {
  console.error('Missing GEMINI_API_KEY in the environment.')
  process.exit(1)
}

// Grounding is supported on the flash models via the google_search tool.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`

const args = process.argv.slice(2)
const wanted = args.length > 0 ? args : ['tomato', 'garlic', 'courgette', 'carrot', 'lettuce']

const crops = loadCrops().filter((c) => wanted.includes(c.slug))

function prompt(nameNl: string, nameEn: string): string {
  return [
    `Voor welke maanden in Nederland moet je ${nameNl} (${nameEn}) in de moestuin:`,
    `- binnen voorzaaien (sow indoors)`,
    `- buiten zaaien (sow outdoors)`,
    `- uitplanten/verpoten (transplant)`,
    `- oogsten (harvest)`,
    ``,
    `Baseer je op Nederlandse zaaikalenders (bijv. moestuin.nl, groei & bloei,`,
    `De Bolster, Velt). Geef per handeling een maandbereik (bv. "maart-april").`,
    `Antwoord ALLEEN met JSON in dit formaat, geen extra tekst:`,
    `{"sow_indoor":"","sow_outdoor":"","transplant":"","harvest":""}`,
  ].join('\n')
}

interface GroundingChunk { web?: { uri?: string; title?: string } }

async function askGemini(nameNl: string, nameEn: string) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt(nameNl, nameEn) }] }],
      tools: [{ google_search: {} }],
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> }
      groundingMetadata?: { groundingChunks?: GroundingChunk[] }
    }>
  }
  const cand = json.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((u): u is string => Boolean(u))
  return { text, sources }
}

for (const crop of crops) {
  console.log(`\n=== ${crop.slug} (${crop.names.nl}) ===`)
  console.log('OUR DRAFT methods:', crop.methods.map((m) => `${m.type} ${m.start_weeks}..${m.end_weeks}w`).join(' | '))
  try {
    const { text, sources } = await askGemini(crop.names.nl, crop.names.en)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    console.log('GEMINI (grounded):', jsonMatch ? jsonMatch[0] : text.slice(0, 200))
    console.log(`SOURCES (${sources.length}):`, sources.length ? sources.slice(0, 5).join('\n           ') : 'NONE — not grounded, do not trust')
  } catch (e) {
    console.log('ERROR:', e instanceof Error ? e.message : String(e))
  }
}
