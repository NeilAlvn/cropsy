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
  sources: string[]
  /**
   * false = DRAFT: timing populated from general knowledge, NOT yet confirmed
   * against real supplier calendars by a grower. Draft data must never ship as
   * fact. Only flip to true once cross-checked against >=2 sources.
   */
  verified: boolean
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
