// End-to-end smoke test: real crop rules + a real Open-Meteo frost lookup for
// Utrecht → a dated "this week" schedule. Proves the design-independent core
// works before we build anything on top of it.

import { loadCrops } from './loadCrops.ts'
import { scheduleGarden, windowsActiveInRange } from '../src/timing/engine.ts'
import { resolveFrostProfile, dailyRainAndTemp } from '../src/weather/frost.ts'

const UTRECHT = { lat: 52.09, lon: 5.12 }

const crops = loadCrops()
console.log(`Loaded ${crops.length} crops: ${crops.map((c) => c.slug).join(', ')}\n`)

// The base schedule must never depend on the network (offline-first). So if the
// live frost lookup is unreachable, fall back to a national default — exactly
// what the app does on-device with no cached profile.
const NL_DEFAULT = { last_frost: '2026-04-15', first_frost: '2026-11-01' }
console.log('Resolving frost profile for Utrecht via Open-Meteo…')
let frost = NL_DEFAULT
try {
  frost = await resolveFrostProfile(UTRECHT)
  console.log(`  last frost:  ${frost.last_frost}`)
  console.log(`  first frost: ${frost.first_frost}\n`)
} catch {
  console.log(`  (Open-Meteo unreachable — using NL default, as the app would offline)\n`)
}

const schedule = scheduleGarden(crops, frost)
console.log(`Full season schedule (${schedule.length} windows):`)
for (const w of schedule) {
  console.log(`  ${w.start} → ${w.end}  ${w.crop_slug.padEnd(10)} ${w.method}`)
}

// "This week" view, anchored on the last frost so there's something to show.
const today = frost.last_frost
console.log(`\n"This week" (7 days from ${today}):`)
const active = windowsActiveInRange(schedule, today, 7)
if (active.length === 0) console.log('  (nothing active in this window)')
for (const w of active) {
  console.log(`  ${w.crop_slug.padEnd(10)} ${w.method}  (${w.start} → ${w.end})`)
}

console.log('\nWeather adjustment signal (recent + forecast):')
try {
  const weather = await dailyRainAndTemp(UTRECHT)
  const rained = weather.filter((d) => d.precip_mm >= 5).length
  console.log(`  ${weather.length} days fetched; ${rained} with >=5mm rain (would skip watering)`)
} catch {
  console.log('  (Open-Meteo unreachable — offline, the app keeps the base schedule)')
}

console.log('\n✓ smoke test complete')
