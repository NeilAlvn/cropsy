// Watering-task generation — the client owns this (API-CONTRACT §5): watering
// is recurring and driven by pot size, not frost, so it is not part of the base
// schedule. The weather overlay only ever moves or skips what this produces.
//
// TS mirror of lib/timing/watering.dart; docs/fixtures/watering.fixture.json
// proves the two agree. Pure and clock-free.

import type { WaterCadence } from './types'
import type { Task } from './weather-adjust'
import { parseISO, toISO, addDays } from './dates'

// Smaller pots dry out faster. A 3 L herb pot on a hot balcony is daily work;
// a bed holds water for days.
export const DEFAULT_WATER_CADENCE: WaterCadence = { small: 1, medium: 2, large: 3, ground: 4 }

/** Days between waterings for a pot size (litres). null = in-ground. */
export function wateringIntervalDays(
  potLitres: number | null,
  cadence: WaterCadence | null = null,
): number {
  const c = cadence ?? DEFAULT_WATER_CADENCE
  if (potLitres === null) return c.ground
  if (potLitres <= 5) return c.small
  if (potLitres <= 12) return c.medium
  return c.large
}

export interface WateringInput {
  plantId: string
  cropSlug: string
  potLitres: number | null
  /** ISO yyyy-mm-dd; injected, never read from a clock. */
  today: string
  horizonDays?: number
  cadence?: WaterCadence | null
}

/** Watering tasks for one plant across [today, today + horizonDays). */
export function wateringTasksFor(input: WateringInput): Task[] {
  const interval = wateringIntervalDays(input.potLitres, input.cadence ?? null)
  const from = parseISO(input.today)
  const horizon = input.horizonDays ?? 7
  const tasks: Task[] = []
  for (let d = 0; d < horizon; d += interval) {
    const due = toISO(addDays(from, d))
    tasks.push({ id: `water-${input.plantId}-${due}`, crop_slug: input.cropSlug, kind: 'water', due })
  }
  return tasks
}
