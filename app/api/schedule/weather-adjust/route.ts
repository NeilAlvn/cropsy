// POST /api/schedule/weather-adjust — the online overlay (API-CONTRACT §5).
//
// Returns DELTAS ONLY. The base schedule is computed on-device and is always
// valid on its own; this endpoint just nudges individual tasks using live
// weather. That asymmetry is the whole design: if this call fails, times out,
// or the device is offline, the client keeps the base schedule and loses
// nothing. So every failure here returns an empty adjustment list, not an
// error — a degraded answer the client can apply blindly beats an error it
// has to special-case.

import { adjustTasks, DEFAULT_ADJUST, type Task } from '../../../../src/timing/weather-adjust'
import { dailyRainAndTemp } from '../../../../src/weather/frost'

/** Refuse absurd payloads rather than fanning out weather calls for them. */
const MAX_TASKS = 500

interface AdjustRequest {
  lat: number
  lon: number
  tasks: Task[]
}

function isValid(body: unknown): body is AdjustRequest {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  return (
    Number.isFinite(b.lat) &&
    Number.isFinite(b.lon) &&
    Array.isArray(b.tasks) &&
    b.tasks.length <= MAX_TASKS
  )
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!isValid(body)) {
    return Response.json(
      { error: `body must be { lat, lon, tasks[] } with at most ${MAX_TASKS} tasks` },
      { status: 400 },
    )
  }

  // No tasks is a valid question with a trivial answer — don't call the API.
  if (body.tasks.length === 0) return Response.json({ adjustments: [] })

  try {
    const observations = await dailyRainAndTemp({ lat: body.lat, lon: body.lon })
    // The engine is clock-free by design, so the clock is supplied here. Without
    // it the heat rule would happily pull a watering task back onto a hot day
    // that has already been and gone.
    const today = new Date().toISOString().slice(0, 10)
    const adjustments = adjustTasks(body.tasks, observations, { ...DEFAULT_ADJUST, today })
    return Response.json({ adjustments })
  } catch {
    // Weather unavailable → no opinion. The base schedule stands.
    return Response.json({ adjustments: [] })
  }
}
