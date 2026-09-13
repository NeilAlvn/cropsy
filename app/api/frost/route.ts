// GET /api/frost?lat=&lon= — turn a location into the two dates the timing
// engine needs (API-CONTRACT §3).
//
// Derived from climate history, so the answer is stable for a whole season:
// cached hard at the edge and cached again on-device. Coordinates are rounded
// to ~11 km before use — frost dates don't vary meaningfully below that, and it
// keeps the cache from fragmenting into one entry per GPS reading. Rounding is
// also the privacy-preserving choice: we never need a user's exact position.
//
// Open-Meteo's archive endpoint is occasionally slow or down. A frost profile
// that fails is worse than one that's approximate — without it the client has
// no schedule at all — so we fall back to a national default and say so in
// `source`, letting the client decide whether to re-ask later.

import { resolveFrostProfile } from '../../../src/weather/frost'

/** NL/BE climate defaults. Used only when the upstream lookup fails. */
const FALLBACK = { last_frost: '04-15', first_frost: '11-01' }

/** ~0.1° ≈ 11 km. Enough resolution for frost, coarse enough to cache well. */
function round(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * NL postcode → centroid via PDOK Locatieserver (Kadaster, free, no key). The
 * onboarding fallback when location permission is denied (PRD 1.5).
 */
async function geocodePostcode(postcode: string): Promise<{ lat: number; lon: number } | null> {
  const pc = postcode.replace(/\s+/g, '').toUpperCase()
  if (!/^[1-9]\d{3}[A-Z]{2}$/.test(pc)) return null
  const q = new URLSearchParams({ q: pc, fq: 'type:postcode', fl: 'centroide_ll', rows: '1' })
  const res = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3/free?${q}`)
  if (!res.ok) return null
  const body = (await res.json()) as { response?: { docs?: { centroide_ll?: string }[] } }
  const m = body.response?.docs?.[0]?.centroide_ll?.match(/POINT\(([-\d.]+) ([-\d.]+)\)/)
  if (!m) return null
  return { lon: Number(m[1]), lat: Number(m[2]) }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  let lat = Number(url.searchParams.get('lat'))
  let lon = Number(url.searchParams.get('lon'))
  const postcode = url.searchParams.get('postcode')
  if (postcode) {
    const hit = await geocodePostcode(postcode).catch(() => null)
    if (!hit) return Response.json({ error: 'postcode not found (NL 1234AB expected)' }, { status: 404 })
    lat = hit.lat
    lon = hit.lon
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return Response.json(
      { error: 'lat and lon are required and must be valid coordinates' },
      { status: 400 },
    )
  }

  const year = new Date().getUTCFullYear()

  try {
    const profile = await resolveFrostProfile({ lat: round(lat), lon: round(lon) })
    return Response.json(
      { ...profile, lat: round(lat), lon: round(lon), source: 'open-meteo' },
      { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000' } },
    )
  } catch {
    return Response.json(
      {
        last_frost: `${year}-${FALLBACK.last_frost}`,
        first_frost: `${year}-${FALLBACK.first_frost}`,
        lat: round(lat),
        lon: round(lon),
        source: 'fallback',
      },
      // Short cache: a fallback is a degraded answer, so retry sooner.
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
    )
  }
}
