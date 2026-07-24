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
