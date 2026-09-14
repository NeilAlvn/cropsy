// The content snapshot (PRD §8.1): everything GrowIt shows as editorial content
// that isn't a crop rule. Same hash/ETag scheme as crops-snapshot. Near-empty
// until the Phase 3 content sprint; the shape is fixed now so the client can
// build against it.

import { createHash } from 'node:crypto'
import type { LocalizedText } from '../timing/types'
import type { Companions, Problem, Variety } from './types'

export interface Collection {
  slug: string
  title: LocalizedText
  intro: LocalizedText
  crop_slugs: string[]
  image: string | null
}

export interface ChecklistItem {
  /** 1–12 */
  month: number
  title: LocalizedText
  body: LocalizedText
  /** Optional deep link (crop slug or guide url). */
  link: string | null
}

export interface Price {
  crop_slug: string
  /** €/kg or €/piece, NL supermarket average. */
  eur: number
  unit: 'kg' | 'pcs'
  /** Shop page the estimate came from; review aid, shipped as-is. */
  source?: string
}

/** One crop's editorial guide (data/content/crops/<slug>.<lang>.md). */
export interface Guide {
  crop_slug: string
  lang: 'nl' | 'en'
  starting: string
  seedling: string
  vegetative: string
  flowering: string
  harvest: string
  faq: { q: string; a: string }[]
  benefits: string
  sources: string[]
  verified: boolean
  /** Present (true) only in beta snapshots built with CONTENT_INCLUDE_DRAFTS=1. */
  draft?: boolean
}

export interface ContentData {
  collections: Collection[]
  monthly_checklist: ChecklistItem[]
  prices: Price[]
  /** Verified rows only — the builder strips drafts (or marks them in beta). */
  varieties: Variety[]
  companions: Companions
  problems: Problem[]
  guides: Guide[]
}

export interface ContentSnapshot extends ContentData {
  version: string
  generated_at: string
}

export function contentVersion(data: ContentData): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)
}

export interface BuildOptions {
  /**
   * Beta only (PRD §4.3): keep unverified rows, stamped `draft: true`, so the
   * app can show them with a visible "concept" label. Launch builds strip them.
   */
  includeDrafts?: boolean
}

function gate<T extends { verified: boolean; draft?: boolean }>(rows: T[], includeDrafts: boolean): T[] {
  if (!includeDrafts) return rows.filter((r) => r.verified)
  return rows.map((r) => (r.verified ? r : { ...r, draft: true }))
}

export function buildContentSnapshot(input: ContentData, now: Date = new Date(), opts: BuildOptions = {}): ContentSnapshot {
  // Same gate as crops: draft content never reaches the device as fact.
  const inc = opts.includeDrafts ?? false
  const data: ContentData = {
    ...input,
    varieties: gate(input.varieties, inc),
    problems: gate(input.problems, inc),
    guides: gate(input.guides, inc),
  }
  for (const c of data.monthly_checklist) {
    if (c.month < 1 || c.month > 12) throw new Error(`checklist month out of range: ${c.month}`)
  }
  for (const p of data.prices) {
    if (!(p.eur > 0)) throw new Error(`price for ${p.crop_slug} must be > 0`)
  }
  return { version: contentVersion(data), generated_at: now.toISOString(), ...data }
}
