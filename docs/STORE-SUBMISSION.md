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
  `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_SECRET_KEY` (added 2026-09-19).
- Resend domain `send.cropsyapp.com` Verified; DKIM, MX and DMARC
  (`p=quarantine`) resolve. Supabase custom SMTP is enabled against
  `smtp.resend.com:587`, sender `Cropsy <login@send.cropsyapp.com>`. A magic
  link requested through the auth API was delivered by Resend within seconds.
- Supabase organisation L88S Media is on Pro (no project pausing).
- `ITSAppUsesNonExemptEncryption = false` is in `Info.plist`, so builds skip the
  export-compliance question.
- Website pricing cards now say Lifetime €49.99 and list the PRD §9 free-tier
  limits (they said €59.99 and made-up features before).

## Done in App Store Connect on 2026-09-19 (Claude, via Luuk's session)

- App Information: primary language switched to **English (U.K.)** so every
  non-Dutch storefront falls back to English; Dutch stays localised. Names:
  NL `Cropsy: Moestuin Planner` / `Zaaikalender & herinneringen`, EN
  `Cropsy: Garden Planner` / `Plant care & sowing calendar`. Category
  Lifestyle + Utilities. Content rights: yes, third-party content (the crop
  photos). Age rating questionnaire done: **4+**.
- Version 1.0: promotional text, description, keywords (from the ASO
  screenshots: NL `tuinontwerp,groente,tuinplanner,plantenverzorging,
  plantenziekte,balkon,oogst,zaaien,herbs,pots`; EN `allotment,pots,herbs,
  design,pests,journal,homegrown,watering,reminder,transplant,diagnosis,
  harvest`), support/marketing URLs, copyright, six 6.9" screenshots per
  language (simulator captures: season path, home, plant path, garden,
  explore, diagnose). Manual release selected.
- App Privacy: policy URL, eight data types declared and published (email,
  coarse location, photos, other user content, user ID, purchase history,
  product interaction, crash data; none used for tracking).
- Pricing: free, all 175 storefronts, Mac and Vision Pro availability off.
- Subscription `cropsy_yearly`: price changed to **€29.99** (base Netherlands,
  recalculated everywhere). Review screenshot (paywall) + notes on both the
  subscription and `cropsy_lifetime`.
- App icon in the build is now the mascot (`tool/icon/icon-1024.png`).
- The build is **iPhone only** (`TARGETED_DEVICE_FAMILY = 1`): the iPad
  layouts were never tested and iPad screenshots would otherwise be required.

## Luuk — before the first TestFlight build

1. ~~`REVENUECAT_SECRET_KEY`~~ **Done 2026-09-19**: v1 secret key
   `cropsy-api-vercel` in RevenueCat, set in Vercel production, API redeployed.
   Full proof (premium visible server-side) comes with the sandbox purchase.

2. ~~First build~~ **Uploaded 2026-09-21**: `1.0.0 (1)`, Delivery UUID
   `8b386d81-3145-44b2-80bb-3664e1b2a671`, validated and uploaded with
   `altool`. No Xcode account is needed on this Mac: signing and upload run on
   an App Store Connect API key (`cropsy-ci-admin`, Key ID `HYH97DCL82`, Admin,
   file in `~/.appstoreconnect/private_keys/`; Issuer
   `47f95e96-b09e-48b1-85e1-37886c9c2177`). Admin is required: an App Manager
   key archives but fails export with "Cloud signing permission error". The
   team is **`R8MCFDU64H`** (the project used to carry `8UD57A925C`, which
   belongs to nobody here). To ship the next build, bump the `+N` in
   `pubspec.yaml`, then:

   ```bash
   cd cropsy-mobile
   K=HYH97DCL82; I=47f95e96-b09e-48b1-85e1-37886c9c2177
   AUTH=(-allowProvisioningUpdates -authenticationKeyPath ~/.appstoreconnect/private_keys/AuthKey_$K.p8 -authenticationKeyID $K -authenticationKeyIssuerID $I)
   flutter build ios --release --no-codesign
   xcodebuild archive -workspace ios/Runner.xcworkspace -scheme Runner -configuration Release -destination 'generic/platform=iOS' -archivePath build/ios/archive/Runner.xcarchive $AUTH
   xcodebuild -exportArchive -archivePath build/ios/archive/Runner.xcarchive -exportPath build/ios/ipa -exportOptionsPlist ios/ExportOptions.plist $AUTH
   xcrun altool --upload-app -f build/ios/ipa/cropsy.ipa -t ios --apiKey $K --apiIssuer $I
   ```

   The `flutter build` line is not optional and is not there to produce the
   binary. `Info.plist` reads `CFBundleVersion` from
   `$(FLUTTER_BUILD_NUMBER)`, which lives in `ios/Flutter/Generated.xcconfig`
   — a generated file that only Flutter rewrites. `xcodebuild archive` on its
   own happily builds the *previous* build number, and the upload is then
   rejected with `ENTITY_ERROR.ATTRIBUTE.INVALID.DUPLICATE`, "The bundle
   version must be higher than the previously uploaded version". Confirm
   before uploading:

   ```bash
   /usr/libexec/PlistBuddy -c "Print :ApplicationProperties:CFBundleVersion" build/ios/archive/Runner.xcarchive/Info.plist
   ```

2a. ~~Second build~~ **Uploaded 2026-09-23**: `1.0.0 (2)`, Delivery UUID
   `66289dbe-7fd7-4568-acf5-995611af0766`. The first TestFlight round's
   changes: light/dark fixes, the weather card on Home, milestone and content
   stops on the season path, search in Diagnose, and the profile as the
   settings hub.
2b. ~~App Review contact phone~~ **Done**: name, phone, email and notes are
   saved on the version page (checked over the API 2026-09-23).
2c. ~~Third build~~ **Uploaded 2026-09-23 evening**: `1.0.0 (4)`, Delivery
   UUID `5cc81489-10f2-4487-8f1a-f9fa16d59974`. Paywall now shows the yearly
   renewal line, Terms and Privacy links and Restore feedback (App Review
   3.1.2); location copy says ~1 km everywhere; camera/photo purpose strings
   name identify and diagnose; no "beta" wording left. Attached to version
   1.0 as soon as processing finished. Also that evening: Dutch privacy
   policy URL set in App Information, privacy labels confirmed published.
2d. **Demo account** (Neil): create a password user in Supabase → Auth →
   Users, fill Demo Account on the version page, and drop the "will be added
   before submission" sentence from the review notes.
2e. **In-App Purchases on the version page** (Neil, with the sandbox test in
   3): both `cropsy_lifetime` and `cropsy_yearly` are READY_TO_SUBMIT and only
   go to review together with 1.0, so they must be added under "In-App
   Purchases and Subscriptions" on the version page before Submit.
3. **Sandbox tester** in App Store Connect → Users and Access → Sandbox; sign in
   with it on a device and buy `cropsy_lifetime`, then `cropsy_yearly`, then
   Restore. Check the entitlement shows in Settings → Membership.
4. ~~Magic link on a device~~ **Done 2026-09-19 on the simulator**: link from
   Mail opened via `xcrun simctl openurl`, Safari asked "Open with Cropsy?",
   the app opened signed in as the account, Membership Free. Repeat once on a
   real phone when you have the TestFlight build, no code change expected.

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
> In-app purchases: Premium yearly (€29.99) and Lifetime (€49.99), both
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

## Android (Play Console, 2026-09-23 evening)

Play Console app **Cropsy: Garden Planner** already existed as a draft under
the Vision Tech B.V. account (hello@visiontechbv.nl, developer id
`8577504145002136184`, app id `4976214359714233314`, package
`com.cropsyapp.app`). Luuk's personal Play account (l88smits@gmail.com) has no
apps; do not create one there.

Done that evening:

- Signed release bundle. Upload key `android/upload-keystore.jks` + password
  in `android/key.properties`, both gitignored and only on Luuk's Mac —
  **back the keystore up** (1Password); Play App Signing can reset a lost
  upload key but it costs a support ticket. Gradle reads the properties and
  falls back to the debug key when absent. JDK is Homebrew `openjdk@21`
  (`flutter config --jdk-dir /opt/homebrew/opt/openjdk@21`). Build:
  `JAVA_HOME=/opt/homebrew/opt/openjdk@21 flutter build appbundle --release`
  → `build/app/outputs/bundle/release/app-release.aab` (versionCode 4).
- Store listing en-US (default) and nl-NL: name, short and full description
  (App Store text minus the euro prices, Play shows its own), 512 icon,
  1024×500 feature graphic (`tool/store/feature.html`), six 9:16 phone
  screenshots (`tool/store/play/`, rendered from frame.html at 1320×2346 —
  Play rejects the 1320×2868 App Store size), two shots each in the 7" and
  10" tablet slots (Play marks them required; phone shots are accepted).
- Store settings: App, Lifestyle, contact hello@cropsyapp.com,
  https://www.cropsyapp.com.
- App content: privacy policy URL, ads (none), IARC content rating (PEGI 3 /
  Everyone), advertising ID (not used — the bundle has no AD_ID permission),
  government apps (no), financial features (none), health (none). Data safety
  filled through the preview step and **saved as draft**: encrypted in
  transit, account creation by password and email link, account-deletion and
  data-deletion URL `https://www.cropsyapp.com/en/privacy`; approximate
  location, email, user id, photos, purchase history, app interactions
  (opt-in), other user content, crash logs — all collected, none shared, no
  advertising or tracking.
- Internal testing: tester lists "Luuk Smits" and "Neil Alvin Medallon"
  attached to the internal track.

**Still to do for Android (Neil / Luuk):**

1. Upload the AAB. The Chrome extension caps uploads at 10 MB and the bundle
   is 89 MB, so drag `cropsy-mobile/build/app/outputs/bundle/release/app-release.aab`
   into Play Console → Testen en releasen → Interne tests → Nieuwe release
   maken, then Uitrollen. Until a bundle with the BILLING permission is
   uploaded, Play refuses to create in-app products.
2. App access ("Inloggegevens"): answer Ja, paste the demo account (same one
   as for Apple) and the review notes. This unlocks Target audience (answer
   18 and over) and then the data-safety draft can be submitted.
3. In-app products: `cropsy_lifetime` (one-time, €49.99) and `cropsy_yearly`
   (subscription, base plan yearly €29.99) under Inkomsten genereren met
   Play. Then RevenueCat → add Android app `com.cropsyapp.app`, paste the
   Play service-account JSON, copy the public SDK key into
   `lib/config.dart` `revenueCatAndroidKey`, rebuild, re-upload. Until then
   the Android paywall stays on the free tier with the "not available right
   now" copy.

## Deliberately deferred

- Pl@ntNet stays on the free non-commercial plan (500/day) until there are
  first users, then switch to a commercial plan.
- Sentry source maps for the backend (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`,
  `SENTRY_PROJECT` + `withSentryConfig`): add when a server trace is
  unreadable.
- Grower spot-check of 20 random crops (PRD §12.4).
- Accessibility pass (44 pt targets, dynamic type to 130%) and the cold-start
  budget (< 1.5 s on iPhone 12): PRD Phase 4, run with the beta.
