# Crop data verification — method & findings

The crop timing is the moat and the one thing that must never be wrong. This
records how each crop gets from **draft** to **verified**, and what the first
verification pass found.

## Method

1. **Cross-reference, don't copy.** For each crop, check the sowing / planting /
   harvest timing against **≥2 independent published NL sources** (seed suppliers'
   teeltkalenders, established Dutch gardening publications). Individual timing
   facts aren't copyrightable, but a single provider's whole calendar can be — so
   we confirm against several and compile our own, never lift one wholesale.
2. **Convert months → frost-relative.** Published calendars are month-based ("sow
   March–May"); our rules are offsets from the frost date. Convert using the NL
   reference profile (**last frost ≈ 15 Apr, first frost ≈ 1 Nov**).
3. **Only then flip the flag.** `verified: true` + the source list, enforced by
   the linter (a crop claiming verified with <2 sources is an error).

Anything not yet through this pass stays `verified: false` and is treated as
draft — plausible, but not confirmed.

## Finding #1 — frost-tender crops were scheduled far too early ⚠️

**The most important thing this pass caught.**

Dutch practice anchors planting-out of tender crops to **IJsheiligen (11–15 May)**,
not to the meteorological last frost. Sources are unanimous: tomatoes, courgettes,
cucumbers, peppers, aubergines and basil go outside **only after ~15 May**.

The draft anchored transplanting at `last_frost + 1..3 weeks`, which produced:

| Crop | Draft (wrong) | Sources say | Corrected |
|---|---|---|---|
| Tomato | 22 Apr – 6 May | after 15 May | **13–27 May** |
| Courgette | 22 Apr – 6 May | after 12 May, ~end of May | **13–27 May** |
| French bean | 22 Apr – 27 May | from mid-May | **13 May – 17 Jun** |

Worse with live data: Open-Meteo put Utrecht's 2026 last frost at **18 March**, so
the draft rules would have told people to plant tomatoes out in **late March** —
they'd have been killed. This is exactly the wrong-date failure mode that earns
competitors their "inaccurate" one-star reviews.

**Fix:** every frost-tender crop now transplants/direct-sows at **≥ +4 weeks** from
last frost, which lands after IJsheiligen with the NL profile, and still shifts
correctly by location/year because it stays frost-relative. Indoor sowing windows
were re-derived from the corrected transplant dates (6–8 weeks earlier for
tomatoes, longer for peppers, ~4 for cucurbits).

`plant`-type methods (tubers, sets, crowns — potato, onion) are exempt: they go in
underground and are normally planted before the last frost.

## Finding #2 — hardy crops were already right ✓

Lettuce, spinach, peas, carrots, radish matched the published calendars
(March–April direct sowing) with no change needed. The error was specific to
frost-tender crops, not systemic across the dataset.

## Finding #3 — garlic needed a small tightening

Draft had it planted from ~20 Sep; NL sources say **mid-Oct to mid-Nov**. Narrowed
to `first_frost −3w..+2w` → **11 Oct – 15 Nov**.

## Status

**8 of 60 verified** (tomato, courgette, garlic, lettuce, spinach, pea, carrot,
radish). The IJsheiligen correction was applied to *all* frost-tender crops, since
that rule is well-sourced and general — but the remaining crops still need their
own individual cross-reference before their flag flips.

## Still open

- Verify the remaining 52 crops individually.
- **Improve the frost estimate.** `resolveFrostProfile` currently takes the last
  day with min ≤0 °C from a single reference year — noisy, and it's the
  *meteorological* last frost rather than the "safe to plant" date gardeners use.
  A multi-year percentile (e.g. the date after which frost risk drops below ~10%)
  would be more honest and would reduce how much work the +4w offsets are doing.
- A grower's eye over the final set before launch.
