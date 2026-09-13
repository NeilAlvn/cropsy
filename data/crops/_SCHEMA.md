# Crop rule format — the shared artifact

Every crop is one JSON object in `data/crops/<slug>.json`. These rules are the
**moat**: they must be accurate, sourced by cross-referencing several EU seed
suppliers (never copied wholesale from one), and sanity-checked by a grower.

The rules are **frost-relative**, not fixed calendar dates. A date only becomes
concrete once combined with the user's local frost dates + location (see the
timing engine). This is what makes the app accurate per-place and per-year — and
it is exactly what US-zone competitors get wrong.

Both the server and the Flutter client evaluate these same objects (they ship to
the device and sync on a version bump), so the format is deliberately simple:
plain data, no logic.

## Fields

| Field | Type | Meaning |
|-------|------|---------|
| `slug` | string | stable id, e.g. `"tomato"` |
| `names` | `{nl, en}` | display names |
| `category` | string | `fruit-veg` \| `leafy` \| `root` \| `legume` \| `brassica` \| `herb` \| `allium` \| `potato` |
| `frost_tender` | boolean | true = damaged by frost (drives "wait until after last frost") |
| `container_ok` | boolean | grows acceptably in a pot/balcony |
| `min_pot_litres` | number \| null | smallest sensible container; null = not container-suitable |
| `spacing_cm` | number | in-row spacing |
| `vak_per_m2` | number \| null | plants per 30×30 "vak" for square-metre gardeners; null = n/a |
| `sun` | string | `full` \| `partial` \| `shade-tolerant` |
| `methods` | array | one or more sowing/planting methods (below) — the heart of the rule |
| `harvest` | object | `{days_min, days_max}` days from the plant's *outdoor* start (transplant for indoor-started crops, else the sow/plant date) to first harvest |
| `difficulty` | 1 \| 2 \| 3 \| null | easy / medium / hard |
| `water_cadence_days` | `{small, medium, large, ground}` \| null | days between waterings per pot bucket (≤5 L / 6–12 L / >12 L / in-ground); null = engine default `1/2/3/4` |
| `feed_cadence_days` | number \| null | days between feeds once established; null = no routine feeding |
| `depth_mm` | number \| null | sowing/planting depth; null = planted as a plant |
| `germination_days` | number \| null | sowing → emergence; drives the pot-on / thin node |
| `days_to_transplant` | number \| null | indoor sowing → planting out; drives the transplant node |
| `perennial` | boolean | comes back next year |
| `image` | string \| null | file name in the app's `assets/crops/` |
| `sources` | string[] | which supplier calendars this row was cross-checked against |
| `verified` | boolean | `false` = DRAFT (timing from general knowledge, not grower-confirmed). Only `true` after cross-checking ≥2 real sources. Draft data must never ship as fact. |

The eight fields from `difficulty` to `image` were added 2026-09-13 (PRD §8.1)
from general horticultural references, not from the ≥2-source cross-check that
`verified` asserts for the timing windows. They are in scope for the Phase 3
grower spot-check. The linter bounds-checks them; null means unknown and the
path builder simply omits the node that field would have produced.

### `methods[]` — each is one way to get the crop going

| Field | Type | Meaning |
|-------|------|---------|
| `type` | string | `sow_indoor` \| `sow_direct` \| `transplant` \| `plant` (tuber/set) |
| `anchor` | string | `last_frost` \| `first_frost` (which frost date the window is measured from) |
| `start_weeks` | number | week offset from `anchor` for the *start* of the window (negative = before) |
| `end_weeks` | number | week offset from `anchor` for the *end* of the window |
| `min_soil_c` | number \| null | don't direct-sow below this soil/air temp (weather engine gates it); null = ignore |
| `note` | `{nl, en}` \| null | short "why", shown to build trust (spec F1) |

`transplant` methods typically pair with an earlier `sow_indoor` (start seeds
inside, move out after frost). The engine links them by order.

## Worked example

"Start tomatoes indoors 6–8 weeks before last frost; transplant out 1–2 weeks
*after* last frost once soil is ≥12°C" becomes:

```json
"methods": [
  { "type": "sow_indoor", "anchor": "last_frost", "start_weeks": -8, "end_weeks": -6,
    "min_soil_c": null, "note": { "nl": "Zaai binnen voor een vroege oogst.",
    "en": "Start indoors for an early harvest." } },
  { "type": "transplant", "anchor": "last_frost", "start_weeks": 1, "end_weeks": 2,
    "min_soil_c": 12, "note": { "nl": "Pas na de laatste vorst uitplanten.",
    "en": "Only plant out after the last frost." } }
]
```

## Rules of thumb for data entry
- Windows are **generous but honest** — a range, not a single day.
- If a crop is genuinely both direct-sow and transplant, list both methods; the
  UI lets the user pick.
- `frost_tender: true` + a `sow_direct`/`transplant` method must never start
  before `last_frost` week 0. (The linter in `src/timing` will flag this.)
- Every row needs ≥2 entries in `sources`. One source = not verified.
