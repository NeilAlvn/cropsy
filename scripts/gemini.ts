// Minimal grounded Gemini call shared by the drafting scripts. Google-Search
// grounding is mandatory: every draft must come with the URLs it leaned on,
// so a grower can check before flipping `verified`.
import './env.ts'

const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-flash-latest'

export function requireKey(): void {
  if (!KEY) {
    console.error('Missing GEMINI_API_KEY (put it in cropsy/.env).')
    process.exit(1)
  }
}

export interface Grounded<T> {
  data: T
  sources: string[]
}

/** Ask for a JSON object; returns the parsed object + grounding source URLs. */
export async function askJson<T>(prompt: string): Promise<Grounded<T>> {
  requireKey()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] }
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
    }[]
  }
  const cand = json.candidates?.[0]
  const text = cand?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
  if (!match) throw new Error(`no JSON in response: ${text.slice(0, 200)}`)
  const sources = [...new Set((cand?.groundingMetadata?.groundingChunks ?? []).map((c) => c.web?.uri).filter((u): u is string => !!u))]
  return { data: JSON.parse(match[0]) as T, sources }
}
