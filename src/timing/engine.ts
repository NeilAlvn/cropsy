// The timing engine — the deterministic BASE layer.
//
// It turns frost-relative crop rules + a location's frost dates into concrete,
// dated windows. It is intentionally pure and dependency-free: no weather, no
// network, no clock. That's what lets the Flutter client run the exact same
// logic fully offline (the "base schedule" from Chris's reminder split). The
// weather-aware ADJUSTMENT (skip-when-rained, ramp-in-heat, defer-below-soil-temp)
// is a separate online layer applied on top of these windows — see the API
// contract. This file must never reach for it.

import type { Crop, CropMethod, FrostProfile, ScheduledWindow } from './types'

const MS_PER_DAY = 86_400_000

function parseISO(d: string): Date {
  // Treat dates as UTC calendar days to avoid timezone drift shifting a window.
  const parts = d.split('-').map(Number)
  const [y, m, day] = parts
  if (parts.length !== 3 || y === undefined || m === undefined || day === undefined) {
    throw new Error(`invalid ISO date: ${d}`)
  }
  return new Date(Date.UTC(y, m - 1, day))
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + Math.round(weeks * 7) * MS_PER_DAY)
}

function anchorDate(method: CropMethod, frost: FrostProfile): Date {
  return parseISO(method.anchor === 'last_frost' ? frost.last_frost : frost.first_frost)
}

/**
 * Compute the dated windows for a single crop at a location.
 * Deterministic: same crop + same frost profile always yields the same result.
 */
export function scheduleCrop(crop: Crop, frost: FrostProfile): ScheduledWindow[] {
  return crop.methods.map((method) => {
    const anchor = anchorDate(method, frost)
    return {
      crop_slug: crop.slug,
      method: method.type,
      start: toISO(addWeeks(anchor, method.start_weeks)),
      end: toISO(addWeeks(anchor, method.end_weeks)),
      min_soil_c: method.min_soil_c,
      note: method.note,
    }
  })
}

/** Schedule many crops at once (e.g. everything in a user's garden). */
export function scheduleGarden(crops: Crop[], frost: FrostProfile): ScheduledWindow[] {
  return crops
    .flatMap((crop) => scheduleCrop(crop, frost))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
}

/**
 * The "this week" view (spec F2): windows whose range overlaps [today, today+days).
 * `today` is passed in, never read from the clock, so it stays pure and testable.
 */
export function windowsActiveInRange(
  windows: ScheduledWindow[],
  today: string,
  days = 7,
): ScheduledWindow[] {
  const from = parseISO(today)
  const to = new Date(from.getTime() + days * MS_PER_DAY)
  return windows.filter((w) => {
    const ws = parseISO(w.start)
    const we = parseISO(w.end)
    return we >= from && ws < to // overlaps the range
  })
}
