// Weather-adjustment engine — the ONLINE overlay (API contract §5, spec F4).
//
// The base schedule (engine.ts) is deterministic and runs offline. This layer
// nudges individual *tasks* using live weather so reminders stop being dumb:
//   • a watering task is SKIPPED when it has rained / will rain (soil is wet)
//   • a watering task is BROUGHT FORWARD to meet a hot, dry day before it
//   • a sow/transplant task is DEFERRED while the soil is still too cold
// It returns deltas only; the caller applies them on top of the base schedule.
// Offline, none of this runs and the base schedule stands — never blank.
//
// Pure and clock-free: it takes the weather observations as input, so it's fully
// testable and the same rules can be mirrored on-device if ever wanted.

import type { LocalizedText } from './types'
import { parseISO, toISO, addDays } from './dates'

export type TaskKind = 'water' | 'sow' | 'transplant' | 'harvest' | 'feed'

export interface Task {
  id: string
  crop_slug: string
  kind: TaskKind
  /** ISO yyyy-mm-dd the base schedule wants this done. */
  due: string
  /** Soil-temp gate carried from the crop method (sow/transplant only). */
  min_soil_c?: number | null
}

/** One day of weather for a location. Soil temp is proxied by air (mean of min/max). */
export interface DayObservation {
  date: string
  precip_mm: number
  temp_min_c: number
  temp_max_c: number
}

export type AdjustAction = 'skip' | 'defer' | 'bring_forward' | 'none'

export interface Adjustment {
  task_id: string
  action: AdjustAction
  /** New date for defer / bring_forward. Absent for skip / none. */
  to?: string
  reason: LocalizedText
}

export interface AdjustParams {
  /** Days before `due` to count as recent rain. */
  rainLookbackDays: number
  /** Days after `due` whose forecast rain also counts (imminent rain). */
  rainForecastDays: number
  /** Cumulative rain over that window (mm) at/above which watering is skipped. */
  wetThresholdMm: number
  /** Furthest a task may be deferred before we give up and keep the base date. */
  maxDeferDays: number
  /** Daily max at/above which a container plant needs water sooner (°C). */
  heatThresholdC: number
  /** How far before `due` we'll pull a watering forward to meet a hot day. */
  heatLookbackDays: number
  /** A hot day only counts if it's also dry — rain at/above this cancels it. */
  heatDryMaxMm: number
  /**
   * Today (ISO yyyy-mm-dd), so a task is never brought forward into the past.
   * Injected rather than read from a clock — the engine stays pure and the
   * fixtures stay reproducible. `null` disables the clamp.
   */
  today: string | null
}

export const DEFAULT_ADJUST: AdjustParams = {
  rainLookbackDays: 2,
  rainForecastDays: 1,
  wetThresholdMm: 10,
  maxDeferDays: 14,
  // 30 °C is where containers start drying out within a day. Containers are the
  // whole premise of this app — a raised bed buffers heat far better than a
  // 10-litre pot on a balcony, so the threshold is deliberately not a
  // field-grower's number.
  heatThresholdC: 30,
  heatLookbackDays: 3,
  heatDryMaxMm: 2,
  today: null,
}

function meanTemp(o: DayObservation): number {
  return (o.temp_min_c + o.temp_max_c) / 2
}

/**
 * Adjust one task against a weather series (keyed lookup built once by the batch
 * function). Returns `none` when there's no weather to judge on, so missing data
 * never fabricates a change.
 */
function adjustTask(task: Task, byDate: Map<string, DayObservation>, p: AdjustParams): Adjustment {
  const none: Adjustment = { task_id: task.id, action: 'none', reason: { nl: '', en: '' } }
  const due = parseISO(task.due)

  if (task.kind === 'water') {
    // Sum rain across [due - lookback, due + forecast]. Enough → soil's wet, skip.
    let rain = 0
    let haveData = false
    for (let d = -p.rainLookbackDays; d <= p.rainForecastDays; d++) {
      const obs = byDate.get(toISO(addDays(due, d)))
      if (obs) { rain += obs.precip_mm; haveData = true }
    }
    if (!haveData) return none
    if (rain >= p.wetThresholdMm) {
      return {
        task_id: task.id,
        action: 'skip',
        reason: {
          nl: `Genoeg regen rond deze dag (${Math.round(rain)} mm) — overslaan.`,
          en: `Enough rain around this day (${Math.round(rain)} mm) — skip watering.`,
        },
      }
    }

    // Not wet. Is there a hot, dry day BEFORE the watering is due? A container
    // can go from damp to bone dry inside one 30 °C afternoon, so waiting for
    // the scheduled day is how plants get lost in a heatwave.
    //
    // We can only move existing tasks — there's no "add a task" delta — so the
    // honest response is to pull the watering forward to the first hot day
    // rather than invent one. Wet always wins over hot: never water into
    // saturated soil just because it's warm.
    for (let d = -p.heatLookbackDays; d < 0; d++) {
      const day = toISO(addDays(due, d))
      const obs = byDate.get(day)
      if (!obs) continue
      if (obs.temp_max_c < p.heatThresholdC) continue
      if (obs.precip_mm > p.heatDryMaxMm) continue
      // Never schedule into the past. `today` is injected, not read from a
      // clock, so this stays pure and testable.
      if (p.today !== null && day < p.today) continue
      return {
        task_id: task.id,
        action: 'bring_forward',
        to: day,
        reason: {
          nl: `Hitte verwacht (${Math.round(obs.temp_max_c)}°C) — eerder water geven.`,
          en: `Heat expected (${Math.round(obs.temp_max_c)}°C) — water earlier.`,
        },
      }
    }
    return none
  }

  if (task.kind === 'sow' || task.kind === 'transplant') {
    if (task.min_soil_c == null) return none
    const dueObs = byDate.get(task.due)
    if (!dueObs) return none
    // Warm enough already → leave it.
    if (meanTemp(dueObs) >= task.min_soil_c) return none
    // Too cold: find the first upcoming day within maxDefer that's warm enough.
    for (let d = 1; d <= p.maxDeferDays; d++) {
      const obs = byDate.get(toISO(addDays(due, d)))
      if (obs && meanTemp(obs) >= task.min_soil_c) {
        return {
          task_id: task.id,
          action: 'defer',
          to: obs.date,
          reason: {
            nl: `Bodem nog te koud (< ${task.min_soil_c}°C) — uitgesteld tot het warmer is.`,
            en: `Soil still too cold (< ${task.min_soil_c}°C) — held until it warms up.`,
          },
        }
      }
    }
    // Stays cold across the whole window: flag it, but don't invent a date.
    return {
      task_id: task.id,
      action: 'defer',
      to: toISO(addDays(due, p.maxDeferDays)),
      reason: {
        nl: `Bodem blijft te koud (< ${task.min_soil_c}°C) — nog even wachten.`,
        en: `Soil staying too cold (< ${task.min_soil_c}°C) — wait a little longer.`,
      },
    }
  }

  // harvest / feed: not weather-adjusted for now.
  return none
}

/**
 * Adjust a batch of tasks. Only tasks that actually changed are returned, matching
 * the contract's "deltas only" — an empty result means keep the base schedule.
 */
export function adjustTasks(
  tasks: Task[],
  observations: DayObservation[],
  params: AdjustParams = DEFAULT_ADJUST,
): Adjustment[] {
  const byDate = new Map(observations.map((o) => [o.date, o]))
  return tasks
    .map((t) => adjustTask(t, byDate, params))
    .filter((a) => a.action !== 'none')
}
