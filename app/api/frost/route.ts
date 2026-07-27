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

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lon = Number(url.searchParams.get('lon'))

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
      { ...profile, source: 'open-meteo' },
      { headers: { 'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000' } },
    )
  } catch {
    return Response.json(
      {
        last_frost: `${year}-${FALLBACK.last_frost}`,
        first_frost: `${year}-${FALLBACK.first_frost}`,
        source: 'fallback',
      },
      // Short cache: a fallback is a degraded answer, so retry sooner.
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
    )
  }
}
