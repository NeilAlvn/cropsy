// Streaks (PRD §7.3): consecutive days with at least one task completed OR
// explicitly skipped with a reason (rain counts). Freeze days cover a gap:
// 2 per calendar month free, unlimited premium. No XP, no leagues (§7.5).
//
// Pure: takes the set of "active" days and computes the streak ending at
// `today`. Mirrored in lib/timing/streak.dart; fixture in
// docs/fixtures/streak.fixture.json.

import { parseISO, toISO, addDays } from './dates'

export interface StreakParams {
  /** Freeze days available per calendar month (Infinity for premium). */
  freezesPerMonth: number
  /** Winter pause: months (1–12) in which a gap never breaks the streak. */
  pausedMonths: number[]
}

export const DEFAULT_STREAK: StreakParams = { freezesPerMonth: 2, pausedMonths: [] }

export interface StreakResult {
  /** Consecutive-day count ending today (today itself counts only if active). */
  count: number
  /** Freeze days spent, keyed by yyyy-mm. */
  freezesUsed: Record<string, number>
  /** True when today is not yet active — the streak is "at risk" until it is. */
  todayOpen: boolean
}

function ym(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * Walk backwards from `today`. An active day extends the streak; an inactive
 * day is bridged by a freeze (if that month still has one) or by the winter
 * pause; otherwise the streak ends. Today being inactive does not end the
 * streak — the day is still open.
 */
export function computeStreak(
  activeDays: Iterable<string>,
  today: string,
  params: StreakParams = DEFAULT_STREAK,
): StreakResult {
  const active = new Set(activeDays)
  const freezesUsed: Record<string, number> = {}
  let count = 0
  let day = parseISO(today)
  const todayOpen = !active.has(today)
  if (todayOpen) day = addDays(day, -1)

  for (let guard = 0; guard < 3660; guard++) {
    const iso = toISO(day)
    if (active.has(iso)) {
      count++
    } else if (params.pausedMonths.includes(day.getUTCMonth() + 1)) {
      // paused: bridged for free, counts nothing
    } else {
      const m = ym(iso)
      const used = freezesUsed[m] ?? 0
      if (used >= params.freezesPerMonth) break
      freezesUsed[m] = used + 1
    }
    day = addDays(day, -1)
  }
  return { count, freezesUsed, todayOpen }
}
