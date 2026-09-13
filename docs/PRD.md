# Cropsy — Product Requirements & Build Plan

Status: **v1.0 — LOCKED 2026-09-13** · owner: Luuk · build: Luuk + Claude (Neil joins later) · repos: `NeilAlvn/cropsy` (backend), `NeilAlvn/cropsy-mobile` (Flutter), `l88s-media/cropsy-website`

The names "Aviah" and "Chris" in `docs/API-CONTRACT.md` and both READMEs are earlier working personas, not people. Read them as "backend" and "mobile".

Decisions here are final for v1. Changes go through a dated amendment at the bottom of this file, not silent edits.

Supersedes the F1–F7 spec and the "pre-UX shell" framing in both READMEs. Everything in `docs/API-CONTRACT.md` stays valid; this document sits above it.

---

## 0. TL;DR

Cropsy is a **GrowIt clone for NL/EU**, feature-for-feature, with five deliberate departures:

1. **Our house style** — deferred; the current "modernism × naturalism" theme in `lib/design/` is the placeholder until the Nime work is done. Keep every colour, font and radius behind the tokens so the swap is a one-file change.
2. **A mascot** that carries every empty state, every nudge, every "you're not behind" moment.
3. **A Duolingo-style timeline** — the plan is a path you walk, not a calendar you fall behind on. Streaks, daily checklist, and a schedule that **re-derives itself** when you log a delay.
4. **A better database** — GrowIt claims 4,000 varieties and ships wrong dates and contradictory companions. We ship fewer crops, every one verified against two or more NL/EU sources, with variety-level content, companions, pests, FAQs and how-tos that are actually correct for a Dutch balcony.
5. **Honest pricing** — real free tier, a lifetime price, an optional low annual. No card-gated auto-converting trial.

Everything else — onboarding quiz, home feed, crop detail tabs, garden planner grid, growth logs, reminders, explore collections, diagnose, settings — is copied from GrowIt as documented in §5.

Target: **TestFlight beta 2026-11-20 · store launch 2027-01-25**, six weeks before the NL sowing season opens in March.

---

## 1. Why this, why now

The competitive research (2026-09, 20+ apps, ~15k written reviews) found one anchor app with a 4.7-star façade and 3.0/5 in written reviews, and three wounds shared by every incumbent:

| Wound | Evidence | Cropsy answer |
|---|---|---|
| Annual-only subscription for a 4-month hobby | #1 complaint across GrowIt, Planta, Seed to Spoon; "I would pay $40 once" | Free tier + lifetime €49.99 + optional €19.99/yr |
| US-only frost/zone data, Fahrenheit, imperial | ~8% of GrowIt complaints; "can't change the location to the UK" | Frost dates from KNMI/Open-Meteo climate normals per 0.1° cell; metric and Celsius only; IJsheiligen-aware |
| Fixed schedules that break within weeks; user feels "behind", abandons by July | Strongest strategic signal; no incumbent re-plans | Adaptive timeline: log a delay, the path re-derives; the mascot says "not behind, here's the new plan" |

Secondary gaps we also take: horticultural accuracy as a trust signal, an in-season retention loop (daily checklist, harvest logging, succession prompts), and privacy hygiene (no tracking SDKs, no forced review prompts).

What we deliberately do **not** lead with (research says crowded and embarrassing): plant-ID scanning, AR, social network, annual-only billing, Facebook ad funnels with quizzes that over-promise. Scan and Diagnose still exist because GrowIt has them and users expect the tab, but they ship last and via a third-party API, never as the headline.

---

## 2. What already exists (2026-09-13)

**Backend — `cropsy/` (Next 16 on Vercel `fra1`, Supabase `eu-central-1`)**
- 60 crops in `data/crops/*.json`, all `verified: true` against ≥2 NL sources; linter enforces it.
- Pure timing engine (`src/timing/engine.ts`) + weather overlay (`weather-adjust.ts`): skip-when-wet, defer-below-soil-temp, bring-forward-on-heat. Day-exact fixtures in `docs/fixtures/`.
- Live API: `GET /api/crops` (ETag snapshot), `GET /api/frost?lat&lon`, `POST /api/schedule/weather-adjust`.
- Supabase migration `0001`: `gardens`, `garden_plants`, `tasks`, `journal_entries` with owner RLS, soft delete, composite FKs, `updated_at` triggers. Auth: email/password + magic link.

**Mobile — `cropsy-mobile/` (Flutter 3.44 / Dart 3.12)**
- Dart port of both engines with parity tests against the fixtures. Bundled crop snapshot, cold start needs no network.
- Drift schema mirroring migration `0001`.
- **Clickable prototype (~5k lines in `lib/features/`)**: onboarding (hero + location + space + crops), home, this-week, garden + plant detail, crop detail with planting-calendar bar, explore, harvest, paywall, scan and diagnose stubs. Placeholder editorial content in `lib/data/crop_content.dart`.
- No sync, no auth, no notifications, no RevenueCat, no real content, no tests beyond engine parity.

**Website — `cropsy-website` (root of `Gropsy App/`)**: landing page, growing guides, sowing calendar. Live.

**Not yet done**: `api.` subdomain on the existing cropsy domain, bundle id finalisation (`app.visiontech.cropsy` provisional), App Store / Play records. Name is settled: **Cropsy**.

---

## 3. Users, jobs, success

**Primary user**: NL/BE/DE balcony and small-garden grower, 25–45, first to third season, grows in pots, raised beds or a few m² of ground. Wants to know *what to do this week* without reading a book. Uses the app heavily Feb–June, forgets it exists in August.

**Secondary user**: allotment (volkstuin) grower with more space and more crops, cares about rotation and companions, will pay once for a good tool.

**Jobs to be done**
1. "Tell me what I can sow or plant *now*, here, in my space."
2. "Remind me to water, feed, pot on, and harvest — and stop nagging when it rained."
3. "I fell two weeks behind. Tell me what changed, not that I failed."
4. "Is this plant OK? What is eating it?"
5. "Plan next season's layout and keep this year's notes."

**Success metrics (first season, 2027)**
- July MAU ≥ 30% of March MAU (research baseline: incumbents lose most users by July).
- Free → paid conversion ≥ 3% within 60 days; lifetime ≥ 60% of paid mix.
- Written-review sentiment ≥ 60% positive (we will never show an in-app review prompt).
- Zero horticultural-accuracy bug reports that survive triage without a data fix within 7 days.
- D7 retention ≥ 35% for users who add ≥ 1 plant in onboarding.

---

## 4. Product principles

1. **Offline is the default state, not a failure mode.** Base schedule, crop content, reminders and the timeline all work with no network. Weather is an overlay.
2. **The plan bends, the user does not break.** Every date is derived from (frost profile, crop rules, what the user actually logged). Logging reality re-derives the future; nothing is ever "overdue" in red.
3. **Fewer, correct crops beat many wrong ones.** Nothing unverified ships as fact. Draft content is visibly labelled in-app during beta and stripped for launch.
4. **NL first, EU second, world never.** Dutch and English at launch. Frost dates from local climate normals. IJsheiligen (11–15 May) is a first-class concept.
5. **One free garden is genuinely free forever.** The paywall gates breadth (more gardens, more plants, planner grid, diagnose), never the core loop.
6. **The mascot is a companion, not a salesman.** It never appears on the paywall.

---

## 5. Feature specification — GrowIt parity map

Each row: what GrowIt does (from the 128-screen capture), what Cropsy does, and the delta. "Same" means copy the flow and layout, re-skinned with our tokens. Phase numbers reference §11.

### 5.1 First run & onboarding

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 1.1 | Splash → ATT tracking prompt | Splash only. **No ATT prompt** — we don't track. | 1 |
| 1.2 | Three hero slides ("Fresh / Fun / All Year Round") | Three slides, mascot-led, copy TBD by house style. Skippable. | 1 |
| 1.3 | Social-proof slide (1,020,000 users, 114 countries, "#1 based on Sensor Tower") | **Drop.** Replace with "Every date checked against Dutch seed calendars" trust slide once we have ≥ 3 named sources to cite. | 1 |
| 1.4 | "Hi, welcome — let's get to know each other" | Same, spoken by mascot. | 1 |
| 1.5 | **Part 1 — Learn your garden**: location permission → space type (multi: backyard/balcony/indoor/farm/other) → growing method (multi: ground/raised beds/indoor containers/outdoor containers) → space size (4 buckets, m²) → daily sun (full/partial/shade) | Same four questions, m² only, plus **postcode fallback** when location is denied (NL postcode → lat/lon → frost cell). Answers write to `gardens` (kind, sun_hours, lat/lon, size_m2). | 1 |
| 1.6 | **Part 2 — Learn your preference**: experience (never / some / extensive) → food types (multi) → interest tags (easy, fast, high yield…) → companion planting? → organic/conventional → four "do you relate?" statements | Same, minus organic/conventional (no content difference in v1). Statements reworded for NL. Answers write to `profiles.preferences` (jsonb) and drive the "What to grow" ranking. | 1 |
| 1.7 | "GrowIt was made for people just like you" + "Creating your growing plan…" spinner | Same beat, mascot builds the plan on screen: frost dates found → N crops match your space → first task is X. | 1 |
| 1.8 | Notifications permission | Same, asked **after** the first task is shown, with the reason. | 1 |
| 1.9 | Paywall: "Design your trial", 7 days free then $39.99/yr, App Store sheet | **Soft paywall, dismissible**, shown once. Three options: Free (default, selected), Lifetime, Yearly. No trial toggle, no "remind me before trial ends". See §9. | 2 |

### 5.2 Home tab

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 2.1 | Header: location chip · premium badge · settings gear | Same. Location chip opens location sheet (exists). | 1 |
| 2.2 | Search vegetables + "Add plant" button | Same. | 1 |
| 2.3 | "Today's care (N)" — weather card ("Cloudy skies, sunny progress", 12°) + water tasks with checkboxes + "View all tasks" | Same, but the weather card is honest: shows the adjustment it made ("Rained 12 mm, skipped watering"). Tasks come from the local engine + overlay. | 1 |
| 2.4 | "Upcoming harvest (N)" hero cards with harvest date | Same. Harvest date derived from `planted_on` + `harvest.days_min..max`, shown as a range. | 1 |
| 2.5 | "Checklist for [month]" — seasonal article list (grow veggies indoors, plan spring garden, illuminate seedlings…) with month picker | Same UI. Content = 12 monthly checklists × 6–8 items, NL-specific, written in Phase 3 content sprint. Until then hidden. | 3 |
| 2.6 | "What to grow in [month]" — chips (All / Start indoors / Plant outside / Easy…) + 2-col crop cards with method label + heart "plan" button | Same. Exists in prototype; wire to real engine windows + preference ranking. | 1 |
| 2.7 | Content feedback menu (I like / Error in content / Suggestions) on every section "…" | Same, posts to `feedback` table. | 2 |
| 2.8 | Premium upsell banner "Try Premium free for 7 days" | Replace with a single dismissible "Unlock lifetime" card, shown at most once per week. | 2 |

### 5.3 Crop detail (from search, home, explore)

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 3.1 | Hero image, name, Latin name, "Types" carousel (varieties: white/sweet/yellow/torpedo onions…) | Same. Varieties come from the new `varieties` table (§8). Fewer per crop, each with NL availability. | 2 |
| 3.2 | Tab strip: Planting calendar · Difficulty · Suitable location · Soil preparation · Growth timeline · How-tos · FAQ (40) · Benefits · Explore | Same strip. Planting calendar and Growth timeline exist. Difficulty, Suitable location, How-tos, FAQ, Benefits need real content (§8). Soil preparation folded into How-tos "Starting". | 1–3 |
| 3.3 | Planting calendar: 12-month bar chart, green = plant outside, orange = harvest, today marker, legend with dates, "Calendar based on: local climate · plant type" | Same. Bars are the engine's windows for *this user's* frost profile; the "based on" row names the frost cell and source. | 1 |
| 3.4 | Suitable location: hardiness zone + world map, tolerance temperature, preferred sunlight, good neighbours / bad neighbours carousels | **No USDA zone, no world map.** Show: frost tender yes/no, min soil °C, sun, min pot litres, NL suitability badge. Companions from `companions` table. | 2 |
| 3.5 | Difficulty gauge (Easy/Medium/Hard) | Same, field on crop. | 2 |
| 3.6 | How-tos: accordion by stage (Starting / Seedling / Vegetative / Flowering / Harvest) with method links, spacing, depth, water cadence | Same structure, content authored per crop (§8). Spacing/depth/water come from data fields, prose from `crop_content`. | 3 |
| 3.7 | FAQ (40 per crop) with Q → long answer pages | 8–12 per crop at launch, grower-reviewed. | 3 |
| 3.8 | Benefits: nutrition table (portion, kcal, carbs…) + prose | Same, sourced from NEVO (Dutch food composition table, public). | 3 |
| 3.9 | "Do you like the information?" like/dislike + rate-app prompt | Like/dislike only. **Never a rate prompt.** | 2 |
| 3.10 | Bottom bar: "Plan to grow" (heart) / "Growing it" (add) | Same. "Plan to grow" → Planning list; "Growing it" → Set plant details sheet. | 1 |

### 5.4 Add plant

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 4.1 | Sheet: Scan / Search by name | Search by name first; Scan below, greyed with "coming soon" until Phase 4. | 1 |
| 4.2 | Search: top searches, list with Latin names, heart buttons | Same. | 1 |
| 4.3 | "Set plant details": photo, planting date, last watering, place (ground / raised / indoor container / outdoor container), growth stage (Starting / Seedling / Vegetative / Flowering / Harvesting) | Same, plus **variety picker** and **pot size (litres)** when place is a container — pot size drives watering cadence (already in `garden_plants.pot_litres`). "Your input will impact harvest timing and care reminders" stays. | 1 |
| 4.4 | Scan: camera, snap tips, identify, "not a veggie — resnap", AI pre-fills details, "Not this plant? Change" | Phase 4 via third-party identification API (Kindwise/Plant.id class). Same UX. | 4 |

### 5.5 My Garden tab — Planning / Growing / Reminder

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 5.1 | **Planning**: "Garden planner (New)" grid — set up garden (location, name, size cm × cm, feet/cm toggle), drag plants onto cells, per-cell count ("1x", "9x", "~36x"), tutorial overlay, save toast | Same, cm only. Counts from `spacing_cm` → plants per 30 cm cell (`vak_per_m2` exists). Companion warnings on adjacent cells (Planter's strength, GrowIt lacks it). **Premium: more than one garden.** | 3 |
| 5.2 | Planning list: planned crops with difficulty + "Plant in: Mar, Apr, May", "Growing Guide" and "+ Growing" | Same. Months derived from the engine. | 1 |
| 5.3 | **Growing**: plant cards with growth stage + "Harvest in N days", "…" → Remove with confirm | Same. Harvest countdown is the timeline's projected harvest node. | 1 |
| 5.4 | Plant detail: growth stage row → picker (Starting … Harvested), "Set plant details", tabs Growth logs / Planting calendar / Difficulty…, Insights for you (weather-driven cards, e.g. "Cold weather is approaching"), How-tos | Same. Insights come from the weather overlay + frost proximity. **Plus the Duolingo path (§7) as the first tab.** | 1–2 |
| 5.5 | Growth logs: "How is your Tomato doing?" (Bad/Okay/Good/Excellent), up to 9 photos, comment, log list with stage transitions | Same. Writes `journal_entries` (add `mood` int, `stage` text). Photos compressed client-side, stored in Supabase Storage (premium: unlimited; free: 20 photos). | 2 |
| 5.6 | **Reminder**: Today (water / progress) with checkboxes, "In N days" groups, "Log last watering" date picker, smart reminders sheet ("Record rain as watering for outdoor plants") | Same. Local notifications scheduled from the task table; rain-as-watering uses the overlay's skip action. | 1–2 |

### 5.6 Explore tab

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 6.1 | Featured collections (Cancer Fighting, Late-Season Harvests, Mediterranean Diet, Lose Weight, Winter Storage, Bone Strength, Kid Friendly, Easy Harvest) → article + crop list | Same layout. Collections rewritten for NL: *Balkon-starters, Oogst in oktober, Wintergroenten, Kindvriendelijk, Snelle sla, Herzaaien in juli*. No health claims. | 3 |
| 6.2 | Care Course ("Secrets of a Bountiful Vegetable Garden", 5 lessons) and per-crop "Learn how to grow X step-by-step" (7 lessons) | Per-crop lesson track **is** the Duolingo path (§7). One general course at launch. | 3 |
| 6.3 | Category rows: Cooking Spices, Regrow from Scraps, Grow Indoors, Hydroponics | Keep Spices, Regrow, Indoors. Drop hydroponics. | 3 |
| 6.4 | Long-form articles | Reuse the website's growing guides (already written, same repo family). Sync from `cropsy-website/src/content`. | 3 |

### 5.7 Diagnose tab

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 7.1 | Auto Diagnose camera + Common Diseases browser by plant part (Whole plant / Leaves / Stems / Flowers / Fruits / Pests), symptom cards → disease page with symptoms + treatment | Common-problems browser first (offline, our content: ~25 problems common on NL balconies: slakken, luizen, meeldauw, neusrot…). Auto-diagnose via third-party API in Phase 4, always with "this is a guess" copy. | 3–4 |

### 5.8 Settings

| # | GrowIt | Cropsy | Phase |
|---|---|---|---|
| 8.1 | Membership (status, manage, "go to App Store to cancel") | Same via RevenueCat customer info. Lifetime shows "Lifetime — nothing to cancel". | 2 |
| 8.2 | Smart reminders, Clear cache, Help (FAQ accordion), Contact us (email + description + 3 images), Privacy, Terms, Encourage us, App info | Same minus "Encourage us" (rate prompt). Add: **Language (NL/EN)**, **Export my data (JSON)**, **Delete account**. | 2 |

### 5.9 Cross-cutting

- **Location**: sheet with search (exists), GPS button, postcode entry. Frost cell rounded to 0.1°.
- **Language**: NL + EN at launch. All crop content has both.
- **Accessibility**: 44 pt targets, dynamic type to 130%, no colour-only state.
- **Telemetry**: none in v1 beyond RevenueCat and crash reporting (Sentry, EU region). No ad SDKs, no ATT.

---

## 6. The mascot

**Role**: the voice of the app. It delivers plan changes, empty states, streak messages, onboarding, and the "why" behind every date. It never sells.

**Requirements**
- One character, named in the house-style pass (working name: *Sprout*). Vector, 12 poses minimum: idle, wave, thinking, celebrating, sleeping (offline / winter), watering, holding seedling, shrug ("not behind"), pointing, rain, sun, frost.
- Ships as Lottie or Rive; static PNG fallback for notifications.
- Appears: onboarding slides, plan-building screen, every empty state, streak card on Home, path nodes on the timeline, notification icon, "you're not behind" sheet.
- Tone: warm, short, never guilt. Copy deck of ~80 lines in NL and EN, written once, stored in `lib/l10n`.
- Excluded: paywall, error dialogs with technical content, legal screens.

**Dependency**: house style. Until then, a placeholder silhouette with the same 12 pose slots so screens are built against the real API.

---

## 7. The Duolingo timeline

The core differentiator. Replaces "growth stage picker + harvest in N days" as the primary way a user sees a plant's life, and replaces "you are overdue" everywhere in the app.

### 7.1 Per-plant path
A vertical path of nodes, one per stage or task, top = today, scrolling down into the future, up into the past.

Node types (from `tasks.kind` + stages): **sow → (pot on) → transplant → thin → feed → water (recurring, collapsed) → flower → harvest window → harvested**.

Each node: mascot pose, title, date or window, state (done / current / upcoming / skipped), tap → task sheet (mark done, back-date, skip with reason, "I did this on…").

### 7.2 Re-derivation (the "not behind" rule)
When the user logs any node with a date that differs from the plan by > 5 days, the client re-runs the engine with the logged date as the new anchor for all downstream nodes:

```
transplant.logged = 2027-05-28 (plan said 2027-05-14)
→ harvest window shifts +14 days
→ feed schedule re-anchors on transplant
→ if the new harvest window crosses first_frost - 2 weeks: mascot warns, offers "grow it anyway / swap for a faster variety"
```

Rules live in `src/timing/replan.ts` (TS) and `lib/timing/replan.dart` (Dart) with a shared fixture in `docs/fixtures/replan.fixture.json`, same parity discipline as the base engine. Never mutate the past. Never show "overdue"; show "moved".

### 7.3 Garden-level path (Home)
"This week" = union of all plants' current nodes, grouped by day, with the streak card on top. Streak = consecutive days with ≥ 1 task completed *or* explicitly skipped with a reason (rain counts). Freeze days: 2 per month free, unlimited premium — copied from Duolingo, because the July cliff is exactly a broken streak.

### 7.4 Season path (Planning)
Twelve-month horizontal path per garden: sow windows as nodes, harvest as nodes, succession prompts ("bed frees up 2027-07-10 — sow rucola?") auto-inserted from crops whose `sow_direct` window is still open at that date. This is the in-season retention loop the research asked for.

### 7.5 What is *not* gamified
No XP, no leagues, no hearts. Streaks and completed-node counts only. Harvest logs get a yield tally (kg or count) and a "money saved" estimate from a fixed per-crop price table — that is the payoff, not points.

---

## 8. The better database

### 8.1 Reference data (files in `cropsy/data/`, bundled snapshot, ETag-synced)

Current: 60 crops, timing + spacing + sun + pot size + harvest days. Missing everything GrowIt shows as content.

**New / extended files, all with `verified` + `sources`:**

| File | Rows at launch | Fields added |
|---|---|---|
| `crops/*.json` | 60 → **90** (add: pak choi, mizuna, tatsoi, purslane, chard, sorrel, edamame, sweetcorn, pumpkin, melon, strawberry, rhubarb, blueberry-in-pot, raspberry-in-pot, fig-in-pot, plus 15 herbs) | `difficulty` (1–3), `frost_tender`, `min_soil_c` (exists), `water_cadence_days` by pot bucket, `feed_cadence_days`, `depth_mm`, `germination_days`, `days_to_transplant`, `perennial: bool`, `image` |
| `varieties/*.json` | ~3 per crop, **~250** | `crop_slug`, `names`, `days_to_harvest` override, `container_ok`, `suppliers: string[]` (NL seed houses), `traits: string[]` (cherry, bush, early, mildew-resistant…) |
| `companions.json` | full 90×90 matrix, sparse | `good`, `bad`, `reason {nl,en}`, `source` — one source of truth, no contradictions by construction (a linter rejects a pair listed in both) |
| `problems/*.json` | **25** | name, plant parts, symptoms, photo, treatment (organic-first), prevention, `affects: crop_slug[]` |
| `content/<crop>.<lang>.md` | 90 × 2 | how-tos by stage, FAQ (8–12), benefits, soil prep — front-matter keyed, rendered in-app |
| `collections.json` | 8 | slug, title, intro, crop_slugs, image |
| `monthly-checklist.json` | 12 × 6–8 items | month, title, body, link |
| `prices.json` | 90 | €/kg or €/piece NL supermarket average, for the harvest payoff |

**Pipeline**: `scripts/seed-*.ts` drafts with Gemini (key already used by scripts), `lint:*` refuses unverified rows in the snapshot, a grower spot-checks and flips `verified`. Licensing: Permapeople is CC BY-SA — use for cross-checking only, never copy rows, or the whole dataset inherits share-alike.

**Snapshot**: one `generated/content-snapshot.json` next to `crops-snapshot.json`, same hash/ETag scheme, ~1–2 MB. Images ship in the app bundle at 2 sizes; content text ships in the snapshot.

### 8.2 User data (Supabase, migration `0002`)

Add, all with the `0001` conventions (owner, updated_at, deleted_at, composite FK, RLS, no delete grant):

```
profiles          (id = auth.uid, display_name, lang, preferences jsonb, streak_count, streak_frozen_until)
gardens           + size_m2 int, layout jsonb (planner grid), postcode text
garden_plants     + variety_slug text, stage text, stage_changed_on date, place text check(...)
tasks             + node_kind text, planned_due date (original), moved_reason text, skipped bool
journal_entries   + mood int check 1..4, stage text, photo_paths text[]
harvests          (garden_plant_id, harvested_on, amount numeric, unit text check('kg','pcs'))
feedback          (user, target_kind, target_id, sentiment, body)   -- content like/dislike/error
plant_ids         (user, photo_path, result jsonb)                  -- Phase 4 scan/diagnose audit
```

`tasks.planned_due` vs `due` is what lets the timeline show "moved from … to …" and what the replan fixture asserts on.

### 8.3 Sync
Unchanged from API-CONTRACT §6: outbox, delta pull on `updated_at`, last-write-wins. New: `profiles` synced the same way; `harvests` and `feedback` append-only.

---

## 9. Monetization

| Tier | Price | Gets |
|---|---|---|
| Free | €0 | 1 garden, 6 growing plants, full timeline, reminders, all crop content, 20 journal photos, 2 streak freezes/month |
| Lifetime | €49.99 once | Unlimited gardens and plants, planner grid, diagnose, unlimited photos and freezes, export |
| Yearly | €19.99 | Same as lifetime, recurring |

- RevenueCat, same integration as Farmsy (`purchases_flutter`, `GET /api/profile/status`).
- No free trial with card. A 7-day *feature preview* of the planner grid is allowed, no purchase needed, expires silently.
- Paywall shown: once after onboarding (dismissible), when a gated feature is tapped, and at most once a week as a Home card.
- Kill criteria from the research: if free → paid < 2–3% by June 2027, add a €9.99 season pass (March–October).

---

## 10. Architecture (delta only — everything else is in API-CONTRACT.md)

- **Mobile**: Flutter, Drift as UI source of truth, `supabase_flutter` under RLS, `purchases_flutter`, `flutter_local_notifications`, `rive` or `lottie` for the mascot, `sentry_flutter` (EU DSN). No Firebase.
- **Engines**: base (`engine`), overlay (`weather_adjust`), **new `replan`**, **new `watering`** (exists in Dart, port to TS for the fixture). All pure, all fixture-tested on both sides.
- **Backend**: Next 16 API routes on Vercel `fra1`. New routes: `GET /api/content` (snapshot + ETag), `POST /api/identify` and `POST /api/diagnose` (Phase 4 proxies, key server-side), `GET /api/profile/status`. Supabase Storage bucket `journal` with owner-scoped policies.
- **Website**: unchanged; exports growing guides as markdown the content pipeline reads.
- **Design tokens**: `lib/design/colors.dart`, `typography.dart`, `components.dart` are the only files the house-style pass may touch. Screens never hard-code a colour.

---

## 11. Build plan

Two builders: Luuk + Claude, working both repos in one stream (backend/data first, then the Flutter screen that consumes it). Neil joins later and picks up from the checklist. Labels below say *which repo*, not who. Weeks are calendar weeks from 2026-09-14. Each phase ends in something a tester can hold.

### Phase 0 — Unblock (W38, 2026-09-14 → 09-20)
- [x] Name: **Cropsy**. Website + domain exist. Bundle id frozen 2026-09-13: **`com.cropsyapp.app`** (App Store Connect app 6811652686, Dutch primary language; the old `app.visiontech.cropsy` record is renamed "Cropsy (old record)" and can be removed).
- [ ] Luuk: point `api.<cropsy domain>` at the Vercel project; retire the growit-named hostname.
- [x] Both: install Flutter 3.44 on Luuk's Mac (`brew install --cask flutter`), `flutter test` + `flutter analyze` green on `main`. (Flutter 3.47.4 installed 2026-09-13.)
- [x] Backend: migration `0002` (§8.2) written and applied (2026-09-13, with `0003` storage bucket and `0004` tasks.id text); `profiles` row auto-created on signup via trigger.
- [x] PRD locked (this document). Both READMEs point here.

### Phase 1 — Core loop, real data, real sync (W39–W43, → 2026-10-25)
Goal: a user can onboard, get a plan for their frost cell, add plants, see the timeline, get reminders, and have it survive reinstall. Everything offline-capable.

Backend (`cropsy/`)
- [x] `src/timing/replan.ts` + `docs/fixtures/replan.fixture.json` (§7.2).
- [x] Port `watering` to TS, fixture it.
- [x] Extend crop schema with the §8.1 fields; migrate the 60 crops; linter updated.
- [x] `GET /api/content` skeleton serving `collections`, `monthly-checklist`, `prices` (may be near-empty).
- [x] Auth e-mails (magic link) branded (`supabase/templates/magic_link.html`; **apply parked:** `npx supabase config push`); `DELETE /api/account` (**Vercel env parked:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

Mobile (`cropsy-mobile/`)
- [x] Supabase auth (email + magic link) with anonymous-first: user can use the app before signing in; sign-in migrates local rows. (`lib/sync/auth_service.dart`; needs migration 0002 applied to sync `profiles`.)
- [x] Outbox + delta sync for `gardens`, `garden_plants`, `tasks`, `journal_entries`, `profiles` (+ `harvests`, `feedback`). Live round-trip and wipe-reinstall-restore verified 2026-09-13 (1 garden, 5 plants, 50 tasks, journal, profile back byte-for-byte, zero dirty rows).
- [x] `lib/timing/replan.dart` + parity test.
- [x] Onboarding 1.1–1.8 to spec (rewire prototype; postcode fallback).
- [x] Home 2.1–2.4, 2.6 on real data.
- [x] Add plant 4.1–4.3 with variety (free text until `varieties` lands) + pot size + place + start method.
- [x] My Garden: Planning list 5.2, Growing 5.3, Reminder 5.6 with `flutter_local_notifications` (one summary per morning).
- [x] **Per-plant timeline 7.1–7.2** with placeholder mascot slots.
- [x] Crop detail 3.3, 3.10; other tabs show "content coming" cards (how-tos show data rows only).

Exit: internal build on TestFlight (keyless workflow exists). Luuk grows a real plant against it. _Status 2026-09-13: every Phase 1 checkbox done and verified on the simulator; TestFlight build is the remaining step (blocked on the `flutter build ios` tool issue, see handover)._

### Phase 2 — Retention loop, payments, journal (W44–W46, → 2026-11-15)
- [~] Mobile: streaks + freezes (7.3) ✅, garden-level "This week" ✅ (Home today's care; streak card), harvest logging + yield tally ✅ (money needs `prices.json`), growth logs 5.5 ✅ local photos (Storage upload pending bucket 0003), Settings 8.2 partial ✅ (account, sync, export, delete; help/contact/language pending), paywall §9 UI ✅ (RevenueCat pending products), feedback 2.7 / 3.9 ✅ (crop detail), insights cards 5.4 ☐, planting-calendar "based on" row ✅.
- [~] Backend: Storage bucket + policies ✅ (migration `0003`, **push parked**), `GET /api/profile/status` ☐ (needs RevenueCat), `feedback` + `harvests` sync ✅, content snapshot endpoint with ETag ✅, crop fields for 3.4–3.5 populated for all 60 ✅.
- [ ] Luuk: RevenueCat products in App Store Connect + Play Console (needs Phase 0 ids), privacy labels, first pass of mascot brief for the house-style designer.

Exit: **closed beta 2026-11-20**, 20 testers (NL). Feature-complete for the free tier.

### Phase 3 — Content, planner, explore, diagnose browser (W47–W51, → 2026-12-20)
The content sprint. Nothing here needs new architecture.

- [ ] Content: 90 crops verified; ~250 varieties; companions matrix; 25 problems; how-tos + FAQ + benefits for all 90 in NL and EN; 8 collections; 12 monthly checklists; prices. Gemini drafts, Luuk reviews, grower spot-check on 20 random crops.
- [~] Mobile: crop detail tabs 3.1 ☐ (varieties render once data lands), 3.4–3.5 ✅, 3.6–3.8 ☐ (content-coming cards, data rows shown); Explore 6.1 ✅ (snapshot-driven, empty), 6.2–6.4 ☐; Diagnose browser 7.1 (offline part) ✅ shell; **Garden planner grid 5.1** ✅ with companion-warning hook; Season path 7.4 with succession prompts ✅; NL/EN switch ☐ (profile.lang stored).
- [ ] Luuk: house-style hand-off. Tokens swapped in `lib/design/`; mascot poses delivered as Rive/Lottie; copy deck NL/EN.

Exit: open beta 2026-12-20. Store listing assets from the real UI.

### Phase 4 — Scan, auto-diagnose, launch (W1–W4 2027, → 2027-01-25)
- [ ] Backend: `POST /api/identify` and `/api/diagnose` proxies (Kindwise/Plant.id class, EU processing, key server-side, rate-limited per user, gated premium).
- [ ] Mobile: Scan flow 4.4, Auto-diagnose 7.1 with "this is a guess" framing, non-veg rejection ("we're experts in fruits & veggies").
- [ ] Both: bug bash on beta feedback, performance pass (cold start < 1.5 s on iPhone 12), accessibility pass, App Store + Play submission by 2027-01-15.

Exit: **store launch 2027-01-25.**

### Phase 5 — In season (Feb–Jul 2027)
Weekly data fixes from `feedback`. Watch the §3 metrics. Decide on the season pass by June. Permanent plants (fruit trees, berries in ground) and multi-year rotation memory are the first post-launch features, per the research's whitespace ranking.

### Ordering rules
1. Fixtures before UI: no engine change ships without both sides green.
2. Content behind a linter: no unverified row reaches the snapshot.
3. Tokens before pixels: house style lands in Phase 3 and touches three files.
4. Free tier before paywall: Phase 1 has no gating at all.

---

## 12. Open questions

| # | Question | Owner | Needed by |
|---|---|---|---|
| 1 | House style: which Nime tokens carry over, mascot species and name | Luuk | Phase 3 start |
| 2 | Identification vendor: Kindwise vs Plant.id vs Pl@ntNet API; EU data processing | Luuk | Phase 4 |
| 3 | Do we ship Android at launch or iOS first? (Keyless TestFlight exists; no Play pipeline yet) | Luuk | Phase 2 |
| 4 | Grower for the spot-check — who, paid how | Luuk | Phase 3 |
| 5 | Belgium and Germany frost fallbacks: national defaults per country or NL-only at launch | Luuk | Phase 1 |
| 6 | Streak semantics in winter: pause automatically Nov–Jan or let the mascot "sleep"? | Luuk | Phase 2 |

## 13. Risks

- **Content volume** (Phase 3) is the schedule risk. Mitigation: 60 crops fully done beats 90 half done; the linter makes the cut automatic.
- **House style lands late** and forces a re-skin. Mitigation: tokens-only rule; the placeholder theme is already shippable.
- **Replan engine complexity**: keep it to anchor-shifting; no per-crop special cases without a fixture.
- **Copying GrowIt too literally**: copy flows and information architecture, never copy text, images or the "#1 app" claims. Our content is our own.


---

## Amendments

**2026-09-13 — harvest day-count anchor.** `harvest.days_min/max` count from the plant's *outdoor* start: the transplant date for indoor-started crops, otherwise the sow/plant date. That is how the 60 crop rows were entered (tomato 60–85 days is from planting out, not from sowing); `buildPath` in `replan.ts`/`replan.dart` follows it. `_SCHEMA.md` updated.

**2026-09-13 — §8.1 field provenance.** `difficulty`, `water_cadence_days`, `feed_cadence_days`, `depth_mm`, `germination_days`, `days_to_transplant`, `perennial`, `image` were filled for all 60 crops from general horticultural references (`scripts/migrate-crop-fields.ts`), not the ≥2-source cross-check `verified` asserts for timing. Bounds-checked by the linter; grower spot-check in Phase 3. The `flower` node from §7.1 is dropped for v1 — no data field drives it.
