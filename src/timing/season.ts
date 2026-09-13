// The season path (PRD §7.4): one garden, twelve months. Nodes are outdoor
// sow/plant windows for crops the user is growing or planning, harvest
// windows from their paths, and succession prompts — when a harvest window
// ends while another crop's direct-sow window is still open, the bed frees up
// and the app says so. This is the in-season retention loop.
//
// Pure. Mirrored in lib/timing/season.dart, fixture docs/fixtures/season.fixture.json.

import type { Crop, FrostProfile, LocalizedText } from './types'
import { scheduleCrop } from './engine'
import { parseISO, toISO, addDays } from './dates'

export interface SeasonPlant {
  plant_id: string
  crop_slug: string
  /** Harvest window from the plant's path, or null while planning. */
  harvest: { start: string; end: string } | null
}

export type SeasonNodeKind = 'sow_window' | 'harvest_window' | 'succession'

export interface SeasonNode {
  kind: SeasonNodeKind
  crop_slug: string
  /** The plant it belongs to; null for a suggestion. */
  plant_id: string | null
  start: string
  end: string
  /** Succession only: the plant whose harvest frees the space. */
  after_plant_id?: string
  note: LocalizedText | null
}

export interface SeasonParams {
  /** Only suggest crops that can still be sown this many days after the bed frees. */
  minDaysLeftInWindow: number
  /** Cap on suggestions per freed bed. */
  maxSuggestions: number
}

export const DEFAULT_SEASON: SeasonParams = { minDaysLeftInWindow: 14, maxSuggestions: 2 }

/**
 * Build the year's nodes. `catalogue` is every crop the user could sow
 * (usually the whole snapshot); `plants` are the garden's plants.
 */
export function seasonPath(
  plants: SeasonPlant[],
  catalogue: Crop[],
  frost: FrostProfile,
  params: SeasonParams = DEFAULT_SEASON,
): SeasonNode[] {
  const bySlug = new Map(catalogue.map((c) => [c.slug, c]))
  const nodes: SeasonNode[] = []

  for (const p of plants) {
    const crop = bySlug.get(p.crop_slug)
    if (!crop) continue
    for (const w of scheduleCrop(crop, frost)) {
      if (w.method === 'sow_indoor') continue
      nodes.push({ kind: 'sow_window', crop_slug: p.crop_slug, plant_id: p.plant_id, start: w.start, end: w.end, note: w.note })
    }
    if (p.harvest) {
      nodes.push({ kind: 'harvest_window', crop_slug: p.crop_slug, plant_id: p.plant_id, start: p.harvest.start, end: p.harvest.end, note: null })
    }
  }

  // Succession: bed frees at harvest end → crops with an open direct-sow window.
  const growing = new Set(plants.map((p) => p.crop_slug))
  for (const p of plants) {
    if (!p.harvest) continue
    const free = parseISO(p.harvest.end)
    const cutoff = toISO(addDays(free, params.minDaysLeftInWindow))
    const candidates: { crop: Crop; start: string; end: string }[] = []
    for (const crop of catalogue) {
      if (growing.has(crop.slug)) continue
      for (const w of scheduleCrop(crop, frost)) {
        if (w.method !== 'sow_direct') continue
        if (w.start <= p.harvest.end && w.end >= cutoff) {
          candidates.push({ crop, start: p.harvest.end, end: w.end })
          break
        }
      }
    }
    // Quickest to harvest first: the bed is free late in the season.
    candidates.sort((a, b) => a.crop.harvest.days_min - b.crop.harvest.days_min || a.crop.slug.localeCompare(b.crop.slug))
    for (const c of candidates.slice(0, params.maxSuggestions)) {
      nodes.push({
        kind: 'succession',
        crop_slug: c.crop.slug,
        plant_id: null,
        after_plant_id: p.plant_id,
        start: c.start,
        end: c.end,
        note: {
          nl: `Plek vrij na ${bySlug.get(p.crop_slug)?.names.nl ?? p.crop_slug} (${p.harvest.end}) — ${c.crop.names.nl} zaaien kan nog tot ${c.end}.`,
          en: `Space frees up after ${bySlug.get(p.crop_slug)?.names.en ?? p.crop_slug} (${p.harvest.end}) — ${c.crop.names.en} can still be sown until ${c.end}.`,
        },
      })
    }
  }

  return nodes.sort((a, b) => a.start.localeCompare(b.start) || a.kind.localeCompare(b.kind) || a.crop_slug.localeCompare(b.crop_slug))
}
