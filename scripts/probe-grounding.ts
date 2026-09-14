// Which phrasing makes Gemini actually run Google Search? Prints chunk counts.
import { research } from './gemini.ts'
const qs: [string, string][] = [
  ['short-url', 'Volgens Nederlandse tuinbronnen: wanneer zaai je tomaten binnen? Antwoord in 1 zin en noem de bron-URL.'],
  ['search-verb', "Zoek op het web naar actuele Nederlandse tuinpagina's (tuinadvies.nl, velt.nu, makkelijkemoestuin.nl) over het kweken van tomaten in potten. Vat samen wat zij zeggen over zaaien, verspenen, potmaat, water, voeding, bloei, oogst en veelgestelde vragen. Citeer per onderdeel de URL."],
  ['english-search', 'Search the web for Dutch gardening pages about growing tomatoes in containers in the Netherlands (tuinadvies.nl, velt.nu, makkelijkemoestuin.nl, groei.nl). Summarize what they say about sowing, transplanting, pot size, watering, feeding, flowering, harvest and common questions. Cite the URL for each point.'],
]
for (const [k, q] of qs) {
  const r = await research(q)
  console.log(k, '| chunks', r.sources.length, '| text', r.text.length, '|', r.sources.slice(0, 2))
}
