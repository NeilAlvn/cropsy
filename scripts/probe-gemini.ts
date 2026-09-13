// Quick quota probe: which model / mode this key can use right now.
import './env.ts'
const key = process.env.GEMINI_API_KEY
async function main() {
  for (const [label, extra] of [['plain', {}], ['grounded', { tools: [{ google_search: {} }] }]] as const) {
    for (const model of ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest']) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }], ...extra }),
      })
      const t = await r.text()
      console.log(label.padEnd(9), model.padEnd(24), r.status, r.ok ? 'ok' : (t.match(/"quotaId": "([^"]+)"/)?.[1] ?? t.replace(/\s+/g, ' ').slice(0, 140)))
    }
  }
}
main()
