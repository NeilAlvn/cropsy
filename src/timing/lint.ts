// Crop-rule linter. The rules are the moat, so bad data is the worst kind of
// bug — a wrong date silently ships and erodes the "never be wrong" promise.
// This catches the traps _SCHEMA.md warns about, before data reaches users.

import type { Crop } from './types'

export interface LintIssue {
  slug: string
  level: 'error' | 'warn'
  message: string
}

export function lintCrop(crop: Crop): LintIssue[] {
  const issues: LintIssue[] = []
  const err = (message: string) => issues.push({ slug: crop.slug, level: 'error', message })
  const warn = (message: string) => issues.push({ slug: crop.slug, level: 'warn', message })

  // Verification gate. Draft crops are allowed in the repo (warned), but a crop
  // claiming verified:true must actually be cross-referenced (>=2 sources). This
  // is what stops unverified data masquerading as fact — the core "never be
  // wrong" guardrail.
  if (crop.verified) {
    if (!crop.sources || crop.sources.length < 2) {
      err(`marked verified but has ${crop.sources?.length ?? 0} sources (need >=2)`)
    }
  } else {
    warn('DRAFT — timing not yet grower-verified (not launch-ready)')
  }

  if (crop.methods.length === 0) err('has no sowing/planting methods')

  // §8.1 fields: null is allowed (unknown), a value must be sane.
  const range = (name: string, v: number | null, lo: number, hi: number) => {
    if (v != null && (v < lo || v > hi)) err(`${name} ${v} outside ${lo}..${hi}`)
  }
  range('difficulty', crop.difficulty, 1, 3)
  range('depth_mm', crop.depth_mm, 1, 200)
  range('germination_days', crop.germination_days, 2, 60)
  range('days_to_transplant', crop.days_to_transplant, 14, 120)
  range('feed_cadence_days', crop.feed_cadence_days, 5, 60)
  if (crop.water_cadence_days) {
    const c = crop.water_cadence_days
    if (!(c.small <= c.medium && c.medium <= c.large && c.large <= c.ground)) {
      err('water_cadence_days must be non-decreasing small ≤ medium ≤ large ≤ ground')
    }
  }
  const grownFromSeed = crop.methods.some((m) => m.type === 'sow_indoor' || m.type === 'sow_direct')
  if (grownFromSeed && crop.germination_days == null) warn('sown from seed but germination_days unknown')
  if (crop.methods.some((m) => m.type === 'sow_indoor') && crop.days_to_transplant == null) {
    warn('sow_indoor method but days_to_transplant unknown — path has no transplant node')
  }

  for (const m of crop.methods) {
    if (m.end_weeks < m.start_weeks) {
      err(`${m.type}: end_weeks (${m.end_weeks}) is before start_weeks (${m.start_weeks})`)
    }

    // A frost-tender crop must never expose a SEEDLING/TRANSPLANT outdoors before
    // the last frost — those die. `plant` (tubers/crowns/sets) is exempt: it goes
    // in underground and is normal practice before frost (e.g. potato).
    const exposesTenderTissue = m.type === 'transplant' || m.type === 'sow_direct'
    if (crop.frost_tender && exposesTenderTissue && m.anchor === 'last_frost' && m.start_weeks < 0) {
      err(`${m.type}: frost-tender crop starts ${-m.start_weeks}w BEFORE last frost — will be killed`)
    }

    // Container-suitable but no pot size is an onboarding gap (F3 needs it).
    if (crop.container_ok && crop.min_pot_litres == null) {
      warn('container_ok but no min_pot_litres set')
    }
  }

  return issues
}

export function lintCrops(crops: Crop[]): LintIssue[] {
  return crops.flatMap(lintCrop)
}
