// Does a drafting-style prompt actually trigger Google Search? Prints the
// grounding chunk count and the real (redirect) URIs Gemini grounded on.
import { askJson } from './gemini.ts'
async function main() {
  const r = await askJson<{ slug: string; sources: string[] }[]>(`
List 2 common pests of container-grown lettuce in the Netherlands. Return ONLY a JSON array of {"slug", "names": {"nl","en"}, "symptoms": {"nl","en"}, "sources": [URLs you used]}.`)
  console.log('items', r.data.length, '| grounding chunks', r.sources.length)
  console.log('chunk uris', r.sources.slice(0, 3))
  console.log('model urls', r.data.flatMap((d) => d.sources).slice(0, 4))
}
main()
