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

  // One source = not verified. The whole point is cross-referencing.
  if (!crop.sources || crop.sources.length < 2) {
    err(`needs >=2 sources, has ${crop.sources?.length ?? 0}`)
  }

  if (crop.methods.length === 0) err('has no sowing/planting methods')

  for (const m of crop.methods) {
    if (m.end_weeks < m.start_weeks) {
      err(`${m.type}: end_weeks (${m.end_weeks}) is before start_weeks (${m.start_weeks})`)
    }

    // A frost-tender crop must never go OUTSIDE before the last frost.
    const isOutdoorPlanting = m.type === 'transplant' || m.type === 'sow_direct' || m.type === 'plant'
    if (crop.frost_tender && isOutdoorPlanting && m.anchor === 'last_frost' && m.start_weeks < 0) {
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
