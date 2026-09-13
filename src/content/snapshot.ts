// The content snapshot (PRD §8.1): everything GrowIt shows as editorial content
// that isn't a crop rule. Same hash/ETag scheme as crops-snapshot. Near-empty
// until the Phase 3 content sprint; the shape is fixed now so the client can
// build against it.

import { createHash } from 'node:crypto'
import type { LocalizedText } from '../timing/types'

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
}

export interface ContentData {
  collections: Collection[]
  monthly_checklist: ChecklistItem[]
  prices: Price[]
}

export interface ContentSnapshot extends ContentData {
  version: string
  generated_at: string
}

export function contentVersion(data: ContentData): string {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16)
}

export function buildContentSnapshot(data: ContentData, now: Date = new Date()): ContentSnapshot {
  for (const c of data.monthly_checklist) {
    if (c.month < 1 || c.month > 12) throw new Error(`checklist month out of range: ${c.month}`)
  }
  for (const p of data.prices) {
    if (!(p.eur > 0)) throw new Error(`price for ${p.crop_slug} must be > 0`)
  }
  return { version: contentVersion(data), generated_at: now.toISOString(), ...data }
}
