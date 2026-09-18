/**
 * Crash reporting. PRD §5.9: Sentry (EU region) and RevenueCat are the only
 * telemetry the product has — no analytics SDK, no ads, no ATT.
 *
 * `SENTRY_DSN` unset = the SDK never initialises and every capture is a no-op,
 * so local runs and preview deployments stay silent. Set it in Vercel
 * (all environments) with a DSN from a Sentry project in the EU region;
 * the region is part of the DSN host (`*.ingest.de.sentry.io`).
 */
import * as Sentry from "@sentry/nextjs";

export function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    // preview / production on Vercel, undefined locally.
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Errors only. The routes are thin proxies over Supabase and two vendors;
    // tracing would spend quota on spans nobody reads.
    tracesSampleRate: 0,
    // Off by design: requests carry a Supabase bearer token and a user's
    // garden. With PII off the SDK drops bodies, cookies, the caller's IP and
    // any header whose name looks like a credential.
    sendDefaultPii: false,
  });
}

/** Server errors Next catches (route handlers, rendering) reach Sentry here. */
export const onRequestError = Sentry.captureRequestError;
