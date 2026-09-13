// The Duolingo timeline engine (PRD §7): builds a plant's path of nodes and
// re-derives the future when the user logs reality.
//
// Two rules, nothing more (PRD §13: anchor-shifting only, no per-crop cases):
//   1. buildPath — crop fields + a start date → dated nodes.
//   2. logNode   — a logged date that differs from plan by > threshold shifts
//                  every unlogged downstream node by the same delta. The past
//                  is never mutated. Nothing is "overdue"; it is "moved".
//
// Pure and clock-free. Mirrored in lib/timing/replan.dart; the two must agree
// to the day against docs/fixtures/replan.fixture.json.

import type { Crop, LocalizedText, MethodType } from './types'
import { parseISO, toISO, addDays, MS_PER_DAY } from './dates'

export type NodeKind =
  | 'sow' | 'pot_on' | 'transplant' | 'thin' | 'feed' | 'water' | 'harvest' | 'harvested'

export interface PathNode {
  id: string
  kind: NodeKind
  /** The date the original plan gave this node. Never changes. */
  planned_due: string
  /** Where the node sits now (after replans). */
  due: string
  /** Window end for `harvest` (inclusive); null for point-in-time nodes. */
  until: string | null
  /** The date the user did it, or null. */
  logged_on: string | null
  skipped: boolean
  /** Set when a replan moved this node; shown instead of "overdue". */
  moved_reason: LocalizedText | null
}

export interface PathStart {
  method: MethodType
  /** ISO date the user sowed / planted / transplanted. */
  on: string
}

// How long after emergence a seedling is handled. Fixed, not per-crop (§13).
const POT_ON_AFTER_EMERGENCE_DAYS = 14
const THIN_AFTER_EMERGENCE_DAYS = 7
// Feeding starts here when the path has no transplant node to anchor on.
const FEED_START_WITHOUT_TRANSPLANT_DAYS = 28
const MAX_FEED_NODES = 30

function node(id: string, kind: NodeKind, due: string, until: string | null = null): PathNode {
  return { id, kind, planned_due: due, due, until, logged_on: null, skipped: false, moved_reason: null }
}

/**
 * Derive the path for one plant. Missing crop fields simply omit the node they
 * would have produced, so a crop with only timing data still yields
 * start → harvest.
 */
export function buildPath(crop: Crop, start: PathStart, plantId: string): PathNode[] {
  const on = parseISO(start.on)
  const at = (days: number) => toISO(addDays(on, days))
  const id = (kind: NodeKind, n = 0) => `${plantId}-${kind}${n ? `-${n}` : ''}`
  const nodes: PathNode[] = []

  // Start node. `plant` (tubers, sets, crowns) is a sow-equivalent: it goes in
  // the ground on this date. Bought seedlings start at the transplant.
  const startsAtTransplant = start.method === 'transplant'
  nodes.push(node(id(startsAtTransplant ? 'transplant' : 'sow'), startsAtTransplant ? 'transplant' : 'sow', start.on))

  let transplantDue: string | null = startsAtTransplant ? start.on : null

  if (start.method === 'sow_indoor') {
    if (crop.germination_days != null) {
      nodes.push(node(id('pot_on'), 'pot_on', at(crop.germination_days + POT_ON_AFTER_EMERGENCE_DAYS)))
    }
    if (crop.days_to_transplant != null) {
      transplantDue = at(crop.days_to_transplant)
      nodes.push(node(id('transplant'), 'transplant', transplantDue))
    }
  }
  if (start.method === 'sow_direct' && crop.germination_days != null) {
    nodes.push(node(id('thin'), 'thin', at(crop.germination_days + THIN_AFTER_EMERGENCE_DAYS)))
  }

  // Harvest window. harvest.days_* count from the plant's OUTDOOR start: the
  // transplant for indoor-started crops, otherwise the sow/plant date. That is
  // how the crop files are entered (tomato: 60–85 days from planting out).
  const harvestFrom = parseISO(transplantDue ?? start.on)
  const harvestDue = toISO(addDays(harvestFrom, crop.harvest.days_min))
  const harvestUntil = toISO(addDays(harvestFrom, crop.harvest.days_max))
  nodes.push(node(id('harvest'), 'harvest', harvestDue, harvestUntil))

  if (crop.feed_cadence_days != null) {
    let feed = parseISO(transplantDue ?? at(FEED_START_WITHOUT_TRANSPLANT_DAYS))
    const stop = parseISO(harvestDue)
    for (let n = 1; n <= MAX_FEED_NODES; n++) {
      feed = addDays(feed, crop.feed_cadence_days)
      if (feed >= stop) break
      nodes.push(node(id('feed', n), 'feed', toISO(feed)))
    }
  }

  // Sorted by date; ties keep insertion order (start node first).
  return nodes.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
}

export interface ReplanParams {
  /** Logged-vs-plan difference (days) above which downstream nodes move. */
  thresholdDays: number
  /** Average first autumn frost for the garden, or null to skip the warning. */
  firstFrost: string | null
  /** Harvest windows ending within this many days of first frost warn. */
  frostMarginDays: number
}

export const DEFAULT_REPLAN: ReplanParams = { thresholdDays: 5, firstFrost: null, frostMarginDays: 14 }

export interface ReplanWarning {
  code: 'harvest_near_frost'
  node_id: string
  reason: LocalizedText
}

export interface ReplanResult {
  nodes: PathNode[]
  /** Days every downstream node moved (0 = within threshold, nothing moved). */
  shift_days: number
  warnings: ReplanWarning[]
}

const KIND_NL: Record<NodeKind, string> = {
  sow: 'zaaien', pot_on: 'verpotten', transplant: 'uitplanten', thin: 'uitdunnen',
  feed: 'bemesten', water: 'water geven', harvest: 'oogsten', harvested: 'geoogst',
}
const KIND_EN: Record<NodeKind, string> = {
  sow: 'sowing', pot_on: 'potting on', transplant: 'planting out', thin: 'thinning',
  feed: 'feeding', water: 'watering', harvest: 'harvest', harvested: 'harvested',
}

function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / MS_PER_DAY)
}

/**
 * Record that `nodeId` was done on `loggedOn` and re-derive the future.
 * Returns a new array; the input is not mutated.
 */
export function logNode(
  nodes: PathNode[],
  nodeId: string,
  loggedOn: string,
  params: ReplanParams = DEFAULT_REPLAN,
): ReplanResult {
  const i = nodes.findIndex((n) => n.id === nodeId)
  if (i < 0) throw new Error(`unknown node: ${nodeId}`)
  const anchor = nodes[i]!
  const out = nodes.map((n) => ({ ...n }))
  out[i] = { ...anchor, logged_on: loggedOn }

  const delta = diffDays(loggedOn, anchor.due)
  if (Math.abs(delta) <= params.thresholdDays) return { nodes: out, shift_days: 0, warnings: [] }

  const sign = delta > 0 ? '+' : '−'
  const reason: LocalizedText = {
    nl: `Verplaatst (${sign}${Math.abs(delta)} dagen): ${KIND_NL[anchor.kind]} was ${delta > 0 ? 'later' : 'eerder'} dan gepland.`,
    en: `Moved (${sign}${Math.abs(delta)} days): ${KIND_EN[anchor.kind]} was ${delta > 0 ? 'later' : 'earlier'} than planned.`,
  }

  const warnings: ReplanWarning[] = []
  for (let j = i + 1; j < out.length; j++) {
    const n = out[j]!
    if (n.logged_on !== null || n.skipped) continue // never mutate the past
    n.due = toISO(addDays(parseISO(n.due), delta))
    if (n.until !== null) n.until = toISO(addDays(parseISO(n.until), delta))
    n.moved_reason = reason

    if (n.kind === 'harvest' && params.firstFrost !== null) {
      const limit = toISO(addDays(parseISO(params.firstFrost), -params.frostMarginDays))
      if ((n.until ?? n.due) > limit) {
        warnings.push({
          code: 'harvest_near_frost',
          node_id: n.id,
          reason: {
            nl: `De oogst loopt nu tot ${n.until ?? n.due}, dicht bij de eerste vorst (${params.firstFrost}). Toch doorgaan, of een sneller ras kiezen?`,
            en: `Harvest now runs until ${n.until ?? n.due}, close to first frost (${params.firstFrost}). Grow it anyway, or swap for a faster variety?`,
          },
        })
      }
    }
  }
  return { nodes: out, shift_days: delta, warnings }
}
