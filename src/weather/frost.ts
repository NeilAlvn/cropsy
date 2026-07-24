// Weather spike — the free half (Open-Meteo, which serves the KNMI model for NL
// and covers all of Europe). Two jobs:
//
//   1. resolveFrostProfile() — turn a lat/lon into the last-spring / first-autumn
//      frost dates the timing engine needs. Derived from climate normals, so it's
//      stable and can be cached per location + shipped to the device.
//
//   2. dailyRainAndTemp() — recent + forecast daily min temp and precipitation,
//      the raw signal for the online reminder ADJUSTMENT (skip-when-rained,
//      defer-below-soil-temp). This layer is optional: offline, the app falls
//      back to the base schedule from the engine.
//
// No API key required for Open-Meteo's free tier. Endpoints verified against
// https://open-meteo.com/en/docs (archive + forecast).

export interface LatLon {
  lat: number
  lon: number
}

export interface FrostProfile {
  last_frost: string
  first_frost: string
}

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const FORECAST = 'https://api.open-meteo.com/v1/forecast'

/**
 * Estimate frost dates from the daily minimum temperatures of a recent year.
 * MVP heuristic: last spring day (Jan–Jun) with min <= 0°C = last frost; first
 * autumn day (Aug–Dec) with min <= 0°C = first frost. A later pass can average
 * several years / use a percentile; this is enough to drive the engine now.
 */
export async function resolveFrostProfile(
  { lat, lon }: LatLon,
  refYear = new Date().getUTCFullYear() - 1,
  fetchImpl: typeof fetch = fetch,
): Promise<FrostProfile> {
  const url =
    `${ARCHIVE}?latitude=${lat}&longitude=${lon}` +
    `&start_date=${refYear}-01-01&end_date=${refYear}-12-31` +
    `&daily=temperature_2m_min&timezone=UTC`

  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`)
  const json = (await res.json()) as { daily: { time: string[]; temperature_2m_min: number[] } }

  const { time, temperature_2m_min: tmin } = json.daily
  let lastSpring: string | null = null
  let firstAutumn: string | null = null

  for (let i = 0; i < time.length; i++) {
    const day = time[i]
    const low = tmin[i]
    if (day === undefined || low == null) continue
    const month = Number(day.slice(5, 7))
    const frost = low <= 0
    if (frost && month <= 6) lastSpring = day
    if (frost && month >= 8 && firstAutumn == null) firstAutumn = day
  }

  // Project onto the coming season by swapping the year for a usable default.
  const nextYear = new Date().getUTCFullYear()
  return {
    last_frost: (lastSpring ?? `${refYear}-04-15`).replace(String(refYear), String(nextYear)),
    first_frost: (firstAutumn ?? `${refYear}-11-01`).replace(String(refYear), String(nextYear)),
  }
}

export interface DailyWeather {
  date: string
  temp_min_c: number
  temp_max_c: number
  precip_mm: number
}

/** Recent-past + near-future daily rain & temps, for the reminder adjustment. */
export async function dailyRainAndTemp(
  { lat, lon }: LatLon,
  fetchImpl: typeof fetch = fetch,
): Promise<DailyWeather[]> {
  const url =
    `${FORECAST}?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,temperature_2m_min,temperature_2m_max&past_days=7&forecast_days=7&timezone=auto`

  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`Open-Meteo forecast ${res.status}`)
  const json = (await res.json()) as {
    daily: {
      time: string[]
      precipitation_sum: number[]
      temperature_2m_min: number[]
      temperature_2m_max: number[]
    }
  }
  return json.daily.time.map((date, i) => ({
    date,
    temp_min_c: json.daily.temperature_2m_min[i] ?? NaN,
    temp_max_c: json.daily.temperature_2m_max[i] ?? NaN,
    precip_mm: json.daily.precipitation_sum[i] ?? 0,
  }))
}
