// The crop snapshot the client bundles (API-CONTRACT §2).
//
// The client ships a snapshot so the base schedule works on first launch with
// no network, then re-pulls only when `version` changes. That makes `version`
// load-bearing: if it churned on every build, every client would re-download
// the full crop table for nothing. So it's a CONTENT HASH, not a timestamp —
// rebuilding unchanged data produces the same version.
//
// Draft crops are refused outright. `verified: false` means the timing was
// written from general knowledge and not confirmed against real supplier
// calendars — shipping that as fact is how you tell someone to plant tomatoes
// in March. The gate lives here so no build path can bypass it.

import { createHash } from 'node:crypto'
import type { Crop } from '../timing/types'

export interface CropSnapshot {
  /** Content hash — changes only when the crop data itself changes. */
  version: string
  /** Human-facing build stamp. Deliberately NOT the version (see above). */
  generated_at: string
  crops: Crop[]
  /** Slugs retired since the last snapshot. Full snapshots carry none. */
  deleted: string[]
}

/** Hash of the crop payload alone — order-independent, timestamp-independent. */
export function snapshotVersion(crops: Crop[]): string {
  const sorted = [...crops].sort((a, b) => a.slug.localeCompare(b.slug))
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16)
}

export function buildSnapshot(crops: Crop[], now: Date = new Date()): CropSnapshot {
  const draft = crops.filter((c) => !c.verified)
  if (draft.length > 0) {
    throw new Error(
      `Refusing to build snapshot: ${draft.length} unverified crop(s) — ` +
        draft.map((c) => c.slug).join(', ') +
        '. Verify against >=2 sources, or drop them.',
    )
  }

  return {
    version: snapshotVersion(crops),
    generated_at: now.toISOString(),
    crops: [...crops].sort((a, b) => a.slug.localeCompare(b.slug)),
    deleted: [],
  }
}

/**
 * Delta view for `GET /api/crops?changed_since=`. The crop table has no
 * per-row timestamps (it's edited as files, not rows), so a changed_since
 * request can't be answered field-by-field — the honest answer is "here is
 * everything, and here is the version you can compare against". The client
 * skips the download when its stored version already matches.
 */
export function isCurrent(snapshot: CropSnapshot, clientVersion: string | null): boolean {
  return clientVersion !== null && clientVersion === snapshot.version
}
