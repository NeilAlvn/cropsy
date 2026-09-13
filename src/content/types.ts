// Reference-content types (PRD §8.1). Plain data, bundled in the content
// snapshot next to the crop rules. Every row carries `verified` + `sources`,
// same discipline as crops: nothing unverified reaches the snapshot.

import type { LocalizedText } from '../timing/types'

export interface Variety {
  slug: string
  crop_slug: string
  names: LocalizedText
  /** Overrides the crop's harvest.days_* when set. */
  days_to_harvest: { min: number; max: number } | null
  container_ok: boolean
  /** NL seed houses that list it. */
  suppliers: string[]
  /** cherry, bush, early, mildew-resistant, … */
  traits: string[]
  sources: string[]
  verified: boolean
}

export interface CompanionPair {
  a: string
  b: string
  reason: LocalizedText
  source: string
}

/** One source of truth: a pair can be good or bad, never both (linted). */
export interface Companions {
  good: CompanionPair[]
  bad: CompanionPair[]
}

export type PlantPart = 'whole' | 'leaves' | 'stems' | 'flowers' | 'fruits' | 'roots'

export interface Problem {
  slug: string
  names: LocalizedText
  /** pest | disease | disorder */
  kind: 'pest' | 'disease' | 'disorder'
  parts: PlantPart[]
  symptoms: LocalizedText
  /** Organic-first. */
  treatment: LocalizedText
  prevention: LocalizedText
  affects: string[]
  image: string | null
  sources: string[]
  verified: boolean
}
