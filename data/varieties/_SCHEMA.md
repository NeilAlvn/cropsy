# Varieties — `data/varieties/<crop_slug>.json`

One file per crop, an array of `Variety` (see `src/content/types.ts`). ~3 per
crop at launch, each with NL availability (`suppliers`). `days_to_harvest`
overrides the crop's harvest window; null = same as the crop. `verified` and
`sources` follow the crop rules: ≥2 sources or it stays out of the snapshot.
