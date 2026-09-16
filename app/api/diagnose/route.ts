// POST /api/diagnose — photo → likely problems (PRD 7.1, premium). Kindwise
// plant.health behind a server-side key (EU processing, Czechia). Always a
// guess: the app frames it that way and links to our own problem pages.
import { caller, bumpUsage, imageFrom } from '../../../src/server/user'
import content from '../../../generated/content-snapshot.json'

const KEY = process.env.KINDWISE_API_KEY
const PER_DAY = 10

// Kindwise disease names → our problem slugs (case-insensitive substring).
const MAP: [needle: string, slug: string][] = [
  ['aphid', 'aphids'], ['slug', 'slugs-and-snails'], ['snail', 'slugs-and-snails'], ['powdery mildew', 'powdery-mildew'],
  ['downy mildew', 'downy-mildew'], ['blossom end rot', 'blossom-end-rot'], ['whitefl', 'whitefly'], ['spider mite', 'spider-mites'],
  ['late blight', 'late-blight'], ['phytophthora', 'late-blight'], ['caterpillar', 'cabbage-white-caterpillar'], ['pieris', 'cabbage-white-caterpillar'],
  ['carrot fly', 'carrot-fly'], ['cabbage root fly', 'cabbage-root-fly'], ['leek moth', 'leek-moth'], ['flea beetle', 'flea-beetles'],
  ['thrips', 'thrips'], ['leaf miner', 'leaf-miner'], ['fungus gnat', 'fungus-gnats'], ['damping', 'damping-off'], ['botrytis', 'grey-mould'],
  ['grey mold', 'grey-mould'], ['gray mold', 'grey-mould'], ['rust', 'allium-rust'], ['root rot', 'root-rot'], ['overwater', 'root-rot'],
  ['sunscald', 'sunscald'], ['sunburn', 'sunscald'], ['nitrogen', 'nitrogen-deficiency'], ['magnesium', 'magnesium-deficiency'],
  ['bolting', 'bolting'], ['crack', 'fruit-cracking'],
]

export async function POST(request: Request): Promise<Response> {
  if (!KEY) return Response.json({ error: 'not_configured' }, { status: 503 })
  const who = await caller(request)
  if (who instanceof Response) return who
  if (!who.premium) return Response.json({ error: 'premium_required' }, { status: 402 })
  const used = await bumpUsage(who.id, 'diagnose')
  if (used > PER_DAY) return Response.json({ error: 'quota', limit: PER_DAY, premium: true }, { status: 429 })

  const img = await imageFrom(request)
  if (img instanceof Response) return img
  const b64 = Buffer.from(await img.bytes.arrayBuffer()).toString('base64')
  const res = await fetch('https://plant.id/api/v3/health_assessment?details=local_name,description,treatment&language=nl', {
    method: 'POST',
    headers: { 'Api-Key': KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ images: [`data:image/jpeg;base64,${b64}`] }),
  })
  if (!res.ok) return Response.json({ error: 'vendor', status: res.status }, { status: 502 })
  const data = (await res.json()) as {
    result?: {
      is_plant?: { binary?: boolean; probability?: number }
      is_healthy?: { binary?: boolean; probability?: number }
      disease?: { suggestions?: { name: string; probability: number; details?: { local_name?: string } }[] }
    }
  }
  if (data.result?.is_plant?.binary === false) return Response.json({ suggestions: [], reason: 'not_a_plant' })
  const known = new Set(content.problems.map((p) => p.slug))
  const suggestions = (data.result?.disease?.suggestions ?? []).slice(0, 5).map((s) => {
    const n = s.name.toLowerCase()
    const hit = MAP.find(([needle]) => n.includes(needle))?.[1] ?? null
    return { name: s.details?.local_name ?? s.name, score: Math.round(s.probability * 100) / 100, problem_slug: hit && known.has(hit) ? hit : null }
  })
  return Response.json({
    healthy: data.result?.is_healthy?.binary ?? null,
    suggestions,
    disclaimer: { nl: 'Dit is een inschatting op basis van de foto, geen diagnose.', en: 'This is a guess from the photo, not a diagnosis.' },
    used,
    limit: PER_DAY,
  })
}
