// Grounded Gemini for the drafting scripts. Two steps, because a "return
// only JSON" prompt makes the model skip Google Search and invent URLs:
//   research()  — a natural-language question WITH the search tool; returns
//                 the answer text plus the real pages it grounded on
//                 (redirect URIs resolved to their final URL).
//   structure() — a plain call (no tools) that turns that text into JSON.
// Every draft therefore carries sources a reviewer can actually open.
import './env.ts'

const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`

export function requireKey(): void {
  if (!KEY) {
    console.error('Missing GEMINI_API_KEY (put it in cropsy/.env).')
    process.exit(1)
  }
}

interface Candidate {
  content?: { parts?: { text?: string }[] }
  groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
}

async function call(body: object): Promise<Candidate> {
  requireKey()
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) {
      const json = (await res.json()) as { candidates?: Candidate[] }
      return json.candidates?.[0] ?? {}
    }
    const text = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 4000 * attempt))
      continue
    }
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 300)}`)
  }
}

const text = (c: Candidate) => c.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

const resolved = new Map<string, string | null>()
async function finalUrl(uri: string): Promise<string | null> {
  if (resolved.has(uri)) return resolved.get(uri)!
  let out: string | null = null
  try {
    const r = await fetch(uri, { redirect: 'follow', signal: AbortSignal.timeout(12_000), headers: { 'user-agent': 'Mozilla/5.0 (Cropsy source check)' } })
    if (r.status < 400) out = r.url
  } catch { /* dead */ }
  resolved.set(uri, out)
  return out
}

export interface Research {
  text: string
  sources: string[]
}

/** Grounded question. Sources are the pages Google Search returned, resolved. */
export async function research(question: string): Promise<Research> {
  const c = await call({
    contents: [{ role: 'user', parts: [{ text: question }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0.2 },
  })
  const uris = [...new Set((c.groundingMetadata?.groundingChunks ?? []).map((k) => k.web?.uri).filter((u): u is string => !!u))]
  const sources: string[] = []
  for (const u of uris) {
    const f = await finalUrl(u)
    if (f && !sources.includes(f)) sources.push(f)
  }
  return { text: text(c), sources }
}

/** Turn research text into JSON. No tools, so nothing new gets invented. */
export async function structure<T>(instruction: string, source: string): Promise<T> {
  const c = await call({
    contents: [{ role: 'user', parts: [{ text: `${instruction}\n\nUse ONLY the notes below. Return ONLY JSON.\n\n<notes>\n${source}\n</notes>` }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  })
  const t = text(c)
  const match = t.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) throw new Error(`no JSON in response: ${t.slice(0, 200)}`)
  return JSON.parse(match[0]) as T
}
