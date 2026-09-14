import './env.ts'
const key = process.env.GEMINI_API_KEY
async function main() {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'Volgens Nederlandse tuinbronnen: wanneer zaai je tomaten binnen? Antwoord in 1 zin en noem de bron-URL.' }] }], tools: [{ google_search: {} }] }),
  })
  const j = await r.json() as any
  const c = j.candidates?.[0]
  console.log('text:', c?.content?.parts?.map((p: any) => p.text).join('').slice(0, 200))
  console.log('metadata keys:', Object.keys(c?.groundingMetadata ?? {}))
  console.log('chunks:', (c?.groundingMetadata?.groundingChunks ?? []).length, 'queries:', c?.groundingMetadata?.webSearchQueries)
  console.log(JSON.stringify(c?.groundingMetadata ?? {}).slice(0, 600))
}
main()
