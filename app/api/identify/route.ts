// POST /api/identify — photo → crop suggestions (PRD 4.4). Pl@ntNet behind
// a server-side key; EU processing (Inria, France). Free: 3 per day, premium:
// 30. Answers are ranked guesses mapped onto our crop slugs when possible.
import { caller, bumpUsage, imageFrom } from '../../../src/server/user'
import snapshot from '../../../generated/crops-snapshot.json'

const KEY = process.env.PLANTNET_API_KEY
const FREE_PER_DAY = 3
const PREMIUM_PER_DAY = 30

// Latin genus/species → our slug. Kept small; unknown species answer with
// the Latin name only and the app says "not one of our crops".
const LATIN: Record<string, string> = {
  'solanum lycopersicum': 'tomato', 'capsicum annuum': 'pepper', 'solanum melongena': 'aubergine', 'cucumis sativus': 'cucumber',
  'cucurbita pepo': 'courgette', 'cucurbita maxima': 'pumpkin', 'lactuca sativa': 'lettuce', 'spinacia oleracea': 'spinach',
  'daucus carota': 'carrot', 'beta vulgaris': 'beetroot', 'raphanus sativus': 'radish', 'allium cepa': 'onion', 'allium sativum': 'garlic',
  'allium porrum': 'leek', 'allium schoenoprasum': 'chives', 'pisum sativum': 'pea', 'phaseolus vulgaris': 'french-bean',
  'phaseolus coccineus': 'runner-bean', 'vicia faba': 'broad-bean', 'brassica oleracea': 'cabbage', 'brassica rapa': 'pak-choi',
  'ocimum basilicum': 'basil', 'petroselinum crispum': 'parsley', 'coriandrum sativum': 'coriander', 'anethum graveolens': 'dill',
  'mentha': 'mint', 'origanum vulgare': 'oregano', 'rosmarinus officinalis': 'rosemary', 'salvia rosmarinus': 'rosemary',
  'salvia officinalis': 'sage', 'thymus vulgaris': 'thyme', 'fragaria': 'strawberry', 'rheum rhabarbarum': 'rhubarb',
  'solanum tuberosum': 'potato', 'zea mays': 'sweetcorn', 'eruca vesicaria': 'rocket', 'eruca sativa': 'rocket',
  'apium graveolens': 'celery', 'foeniculum vulgare': 'fennel', 'melissa officinalis': 'lemon-balm', 'tropaeolum majus': 'nasturtium',
  'borago officinalis': 'borage', 'matricaria chamomilla': 'chamomile', 'vaccinium corymbosum': 'blueberry-in-pot',
  'rubus idaeus': 'raspberry-in-pot', 'ficus carica': 'fig-in-pot', 'ribes rubrum': 'redcurrant-in-pot', 'ribes uva-crispa': 'gooseberry-in-pot',
  'lavandula angustifolia': 'lavender', 'artemisia dracunculus': 'tarragon', 'levisticum officinale': 'lovage', 'anthriscus cerefolium': 'chervil',
  'satureja hortensis': 'summer-savory', 'origanum majorana': 'marjoram', 'aloysia citrodora': 'lemon-verbena', 'cymbopogon citratus': 'lemongrass',
  'stevia rebaudiana': 'stevia', 'glycine max': 'edamame', 'portulaca oleracea': 'purslane', 'claytonia perfoliata': 'winter-purslane',
  'lepidium sativum': 'garden-cress', 'brassica juncea': 'mustard-greens', 'cichorium intybus': 'radicchio', 'valerianella locusta': 'lambs-lettuce',
}

function slugFor(latin: string): string | null {
  const l = latin.toLowerCase()
  for (const [k, v] of Object.entries(LATIN)) if (l.startsWith(k)) return v
  return null
}

export async function POST(request: Request): Promise<Response> {
  if (!KEY) return Response.json({ error: 'not_configured' }, { status: 503 })
  const who = await caller(request)
  if (who instanceof Response) return who
  const used = await bumpUsage(who.id, 'identify')
  const limit = who.premium ? PREMIUM_PER_DAY : FREE_PER_DAY
  if (used > limit) return Response.json({ error: 'quota', limit, premium: who.premium }, { status: 429 })

  const img = await imageFrom(request)
  if (img instanceof Response) return img
  const form = new FormData()
  form.append('images', img.bytes, img.name)
  form.append('organs', 'auto')
  const res = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${KEY}&lang=nl&nb-results=5`, { method: 'POST', body: form })
  if (res.status === 404) return Response.json({ suggestions: [], reason: 'no_match' })
  if (!res.ok) return Response.json({ error: 'vendor', status: res.status }, { status: 502 })
  const data = (await res.json()) as { results?: { score: number; species: { scientificNameWithoutAuthor: string; commonNames?: string[] } }[] }
  const suggestions = (data.results ?? []).map((r) => ({
    latin: r.species.scientificNameWithoutAuthor,
    name: r.species.commonNames?.[0] ?? r.species.scientificNameWithoutAuthor,
    score: Math.round(r.score * 100) / 100,
    crop_slug: slugFor(r.species.scientificNameWithoutAuthor),
  }))
  const known = new Set(snapshot.crops.map((c) => c.slug))
  return Response.json({
    suggestions: suggestions.map((s) => ({ ...s, crop_slug: s.crop_slug && known.has(s.crop_slug) ? s.crop_slug : null })),
    used,
    limit,
  })
}
