# Store submission — what is ready, what Luuk fills in

Written 2026-09-19 from a full pass over the three repos, the dashboards and
the PRD. Everything under "Verified" was checked that day; everything under
"Luuk" needs an account, a secret, or a store action Claude does not do.

## Verified 2026-09-19

- Backend `npm run verify:all`, `lint:crops`, `lint:content` green: 90 crops,
  355 varieties, 25 problems, 180 guides, all `verified: true`.
- Mobile `flutter test` (61) and `flutter analyze` clean; `flutter build ios
  --release --no-codesign` compiles (Xcode 26.6 on this Mac, so a local
  archive + upload works; the CI workflow is the fallback).
- `https://api.cropsyapp.com` and `https://www.cropsyapp.com` answer 200;
  `/api/content` serves the 2.5 MB snapshot with an ETag.
- Vercel production env: `CRON_SECRET`, `NEWSLETTER_SECRET`, `RESEND_API_KEY`,
  `SENTRY_DSN`, `KINDWISE_API_KEY`, `PLANTNET_API_KEY`, `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY`. **Missing: `REVENUECAT_SECRET_KEY`** (below).
- Resend domain `send.cropsyapp.com` Verified; DKIM, MX and DMARC
  (`p=quarantine`) resolve. Supabase custom SMTP is enabled against
  `smtp.resend.com:587`, sender `Cropsy <login@send.cropsyapp.com>`. A magic
  link requested through the auth API was delivered by Resend within seconds.
- Supabase organisation L88S Media is on Pro (no project pausing).
- `ITSAppUsesNonExemptEncryption = false` is in `Info.plist`, so builds skip the
  export-compliance question.
- Website pricing cards now say Lifetime €49.99 and list the PRD §9 free-tier
  limits (they said €59.99 and made-up features before).

## Luuk — before the first TestFlight build

1. **`REVENUECAT_SECRET_KEY`** in Vercel (RevenueCat → project 93eb04ea → API
   keys → secret key). Without it `/api/profile/status`, `/api/identify` and
   `/api/diagnose` treat every paying user as free.

   ```bash
   cd cropsy && vercel env add REVENUECAT_SECRET_KEY production && vercel deploy --prod --yes
   ```

2. **Archive and upload** from this Mac (Xcode 26.6 is installed): Xcode →
   Product → Archive on `ios/Runner.xcworkspace`, Release, then Distribute →
   TestFlight. `1.0.0+1` is fine for the first build.
3. **Sandbox tester** in App Store Connect → Users and Access → Sandbox; sign in
   with it on a device and buy `cropsy_lifetime`, then `cropsy_yearly`, then
   Restore. Check the entitlement shows in Settings → Membership.
4. **Magic link on a device**: request a link from the app, tap it in Mail, the
   app must open on `com.cropsyapp.app://login-callback` and show you signed
   in. (Delivery is proven; the deep link needs a real device.)

## App Store Connect — privacy labels

Declare these. Everything else is "not collected".

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes (account only) | Yes | No | App functionality (account, sync) |
| Coarse location | Yes | No (rounded to ~1 km before it leaves the device) | No | App functionality (frost dates, weather) |
| Photos | Yes (journal, scan) | Yes for journal photos (Supabase bucket, owner only); No for scan photos (sent to Pl@ntNet / Kindwise, not stored) | No | App functionality |
| User content (notes, harvests) | Yes | Yes | No | App functionality |
| Purchase history | Yes | No (RevenueCat anonymous id) | No | App functionality |
| Product interaction | Yes, **only after opt-in** | No | No | Analytics (PostHog EU) |
| Crash data | Yes | No | No | App functionality (Sentry EU) |
| Device ID | No | | | RevenueCat uses its own random id, not IDFA/IDFV |

"Used for tracking" is No everywhere, so no ATT prompt. The privacy policy at
`https://www.cropsyapp.com/nl/privacy` already names every processor above.

## App Store Connect — App Review notes (draft)

> Cropsy is a vegetable-growing planner for the Netherlands. Sign-in is
> optional: everything works without an account. To test sync, use the demo
> account below (email + password; magic links are also supported but need a
> mailbox).
>
> Demo account: `<create one in Supabase → Auth → Users with a password>`
>
> On first open the app asks whether it may collect anonymous usage
> statistics. Answer either way; nothing is sent until you say yes. It asks for
> location once (rounded to about 1 km, used only for frost dates) — a Dutch
> postcode such as 3511 works as the fallback. Notifications are requested
> after the first task appears.
>
> In-app purchases: Premium yearly (€19.99) and Lifetime (€49.99), both
> through StoreKit via RevenueCat. Free tier is one garden and six plants.
> The plant scan (Scan tab) sends a photo to Pl@ntNet; the diagnosis (Diagnose
> tab) to Kindwise. Both are premium-gated after a small free quota.

Fill in the demo account before submitting; the review team cannot receive
magic links.

## Listing fields that exist already

- Support URL: `https://www.cropsyapp.com/nl/support` (EN: `/en/support`)
- Privacy URL: `https://www.cropsyapp.com/nl/privacy`
- Terms: `https://www.cropsyapp.com/nl/terms`
- Marketing URL: `https://www.cropsyapp.com`
- Primary language: Dutch; add English (U.S.) localisation.
- Category: Lifestyle (secondary: Utilities or Reference).
- Age rating: 4+ (no user-generated content shown to others, no web views of
  arbitrary content).
- IAP review screenshots: one screenshot of the paywall per product.

## After approval

- `appStoreUrl` in `src/lib/site.ts` on the website; the badge flips from
  "Binnenkort" to a link. Bump `contentUpdated` there too.
- `src/app/llms.txt/route.ts`: change "Status: in development, not yet
  available" to the store link.
- Delete the ASC record "Cropsy (old record)" (`app.visiontech.cropsy`).

## Android (PRD §12.3, undecided)

Not ready to ship: release build is signed with the debug key, no upload
keystore, `revenueCatAndroidKey` is empty, no Play Console app or IAPs, no
Data Safety form. iOS-first is the zero-work option; the website copy
("Coming to both stores") stays true either way.

## Deliberately deferred

- Pl@ntNet stays on the free non-commercial plan (500/day) until there are
  first users, then switch to a commercial plan.
- Sentry source maps for the backend (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT` + `withSentryConfig`): add when a server trace is
  unreadable.
- Grower spot-check of 20 random crops (PRD §12.4).
- Accessibility pass (44 pt targets, dynamic type to 130%) and the cold-start
  budget (< 1.5 s on iPhone 12): PRD Phase 4, run with the beta.
