// Shared types for the crop rules and the schedule they produce.
// These mirror data/crops/_SCHEMA.md. The Flutter client evaluates the same
// crop objects, so keep this format plain-data and framework-free.

export type MethodType = 'sow_indoor' | 'sow_direct' | 'transplant' | 'plant'
export type FrostAnchor = 'last_frost' | 'first_frost'

export interface LocalizedText {
  nl: string
  en: string
}

export interface CropMethod {
  type: MethodType
  anchor: FrostAnchor
  /** Week offset from the anchor for the START of the window (negative = before). */
  start_weeks: number
  /** Week offset from the anchor for the END of the window. */
  end_weeks: number
  /** Don't act below this soil/air temp; the weather layer gates it. null = ignore. */
  min_soil_c: number | null
  note: LocalizedText | null
}

export interface Crop {
  slug: string
  names: LocalizedText
  category: string
  frost_tender: boolean
  container_ok: boolean
  min_pot_litres: number | null
  spacing_cm: number
  vak_per_m2: number | null
  sun: string
  methods: CropMethod[]
  harvest: { days_min: number; days_max: number }
  // ── PRD §8.1 fields (added 2026-09-13). null = unknown; the path builder and
  // the UI degrade gracefully. Values entered from general horticultural
  // references; grower spot-check is Phase 3 scope. ──
  /** 1 = easy, 2 = medium, 3 = hard. */
  difficulty: 1 | 2 | 3 | null
  /** Per-pot-bucket watering interval override; null = engine default. */
  water_cadence_days: WaterCadence | null
  /** Days between feeds once established; null = no routine feeding. */
  feed_cadence_days: number | null
  /** Sowing / planting depth. null = planted as a plant, not seed. */
  depth_mm: number | null
  /** Typical days from sowing to emergence. null = not grown from seed. */
  germination_days: number | null
  /** Days from indoor sowing to planting out. null = direct-sown / planted. */
  days_to_transplant: number | null
  perennial: boolean
  /** Bundled image file name (app assets), or null. */
  image: string | null
  sources: string[]
  /**
   * false = DRAFT: timing populated from general knowledge, NOT yet confirmed
   * against real supplier calendars by a grower. Draft data must never ship as
   * fact. Only flip to true once cross-checked against >=2 sources.
   */
  verified: boolean
  /** Beta snapshots only: true when this row shipped unverified (badge in-app). */
  draft?: boolean
}

/** Days between waterings per container bucket (see watering.ts for buckets). */
export interface WaterCadence {
  /** ≤ 5 L */
  small: number
  /** 6–12 L */
  medium: number
  /** > 12 L */
  large: number
  /** in-ground / bed (pot_litres null) */
  ground: number
}

/** The two dates that turn frost-relative rules into real calendar windows. */
export interface FrostProfile {
  /** Average last spring frost for the user's location (ISO yyyy-mm-dd). */
  last_frost: string
  /** Average first autumn frost (ISO yyyy-mm-dd). */
  first_frost: string
}

/** A concrete, dated window the app can show and remind on. */
export interface ScheduledWindow {
  crop_slug: string
  method: MethodType
  /** Inclusive window start (ISO yyyy-mm-dd). */
  start: string
  /** Inclusive window end (ISO yyyy-mm-dd). */
  end: string
  /** Soil-temp gate carried through so the weather layer can defer it. */
  min_soil_c: number | null
  note: LocalizedText | null
}
