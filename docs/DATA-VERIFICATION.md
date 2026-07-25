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

## Second pass — the remaining 52, by category

Cross-referenced all remaining crops against published NL calendars (multi-crop
zaaikalenders + crop-specific pages). Six more timing corrections found:

| Crop | Was | Sources say | Now |
|---|---|---|---|
| **Leek** | transplant late Apr–May | pencil-thick → June–July | `+8..12w` → **10 Jun–8 Jul** |
| **Celeriac** | transplant ~late Apr | out after IJsheiligen | `+4..6w` → **13–27 May** |
| **Fennel** (bulb) | direct-sow mid-Apr | bolts if early; sow after 21 Jun | `+9..15w` → **17 Jun–29 Jul** |
| **Celery** | transplant from ~22 Apr | plant out in May | `+3..5w` → **6–20 May** |
| **Potato** | plant Apr only | Mar–May | `−4..+2w` → **18 Mar–29 Apr** |
| **Parsnip** | sow from Apr | from March | `−4..+4w` → **18 Mar–13 May** |

Everything else matched the published calendars. The frost-tender fruiting veg,
legumes, brassicas, leafy greens, roots, alliums, herbs and perennials all check
out; the cucurbits + sweetcorn confirmed the IJsheiligen rule (indoors in April,
out after 15 May, direct-sow once soil ≥ 10–12 °C).

## Status

**60 of 60 verified.** Each crop carries ≥2 published NL sources; the linter
enforces it. Verification method: cross-referencing published calendars, which is
defensible and licence-clean (consensus of several, never one copied wholesale).

## Still open

- **A grower's eye over the final set before launch.** Cross-referencing published
  calendars is strong, but a practitioner spot-check is the belt-and-braces step,
  especially for the timing edge cases (leek, fennel, celeriac).
- **Improve the frost estimate.** `resolveFrostProfile` takes the last day with
  min ≤0 °C from a single reference year — noisy, and it's the *meteorological*
  last frost, not the "safe to plant" date gardeners use. A multi-year percentile
  (date after which frost risk drops below ~10 %) would be more honest and reduce
  how much work the frost-relative offsets are doing.
- A few crops lean on general/perennial sourcing (asparagus, some woody herbs)
  rather than a specific NL month table — fine for planted-once perennials, but
  worth tightening if convenient.
