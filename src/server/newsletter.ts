// Launch-notify list: double opt-in, our own table, no mail-vendor contacts.
//
// The website form posts here; the address is only stored as a subscriber once
// the link in the confirmation mail is followed. Both that link and the
// unsubscribe link carry an HMAC-signed token instead of a database id, so a
// guessed URL cannot subscribe or unsubscribe anyone.

import { createHmac, timingSafeEqual } from 'node:crypto'

import { layout, nl, en, button, fine, send } from './email'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const secret = process.env.NEWSLETTER_SECRET

export const SITE = 'https://www.cropsyapp.com'

export type Locale = 'nl' | 'en'

export const isLocale = (v: unknown): v is Locale => v === 'nl' || v === 'en'

/** Rough and deliberate: mail delivery is the real validation. */
export const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254

/**
 * `<payload>.<signature>`, where payload is base64url JSON. `exp` is seconds
 * since the epoch; unsubscribe tokens never expire, confirmation tokens do.
 */
export function sign(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${createHmac('sha256', secret!).update(body).digest('base64url')}`
}

export function verify(token: string): Record<string, unknown> | null {
  if (!secret) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  // Same length before comparing: timingSafeEqual throws on a mismatch.
  if (sig.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString()) as Record<string, unknown>
  if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) return null
  return claims
}

interface Row {
  email: string
  locale: Locale
  requested_at: string
  confirmed_at: string | null
  unsubscribed_at: string | null
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey!,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  })
}

export async function findSubscriber(email: string): Promise<Row | null> {
  const r = await rest(`subscribers?email=eq.${encodeURIComponent(email)}&select=*`)
  if (!r.ok) return null
  const [row] = (await r.json()) as Row[]
  return row ?? null
}

/** Insert or update the request, leaving `confirmed_at` alone. */
export async function recordRequest(email: string, locale: Locale): Promise<boolean> {
  const r = await rest('subscribers?on_conflict=email', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ email, locale, requested_at: new Date().toISOString() }),
  })
  return r.ok
}

export async function markConfirmed(email: string): Promise<boolean> {
  const r = await rest(`subscribers?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ confirmed_at: new Date().toISOString(), unsubscribed_at: null }),
  })
  return r.ok
}

export async function markUnsubscribed(email: string): Promise<boolean> {
  const r = await rest(`subscribers?email=eq.${encodeURIComponent(email)}`, {
    method: 'PATCH',
    body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
  })
  return r.ok
}

/** Confirmation mail. One button, and no content worth sending to a stranger. */
export async function sendConfirmation(email: string, locale: Locale): Promise<boolean> {
  const token = sign({ email, locale, kind: 'confirm', exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 })
  const href = `${SITE.replace('https://www', 'https://api')}/api/newsletter/confirm?token=${encodeURIComponent(token)}`
  return send(
    email,
    'Bevestig je aanmelding / Confirm your sign-up',
    layout(
      'wave',
      'Het Cropsy-plantje zwaait',
      [
        nl('Je wilt horen wanneer Cropsy uitkomt. Leuk!'),
        nl('Bevestig even via de knop, dan weten we zeker dat dit jouw adres is.', true),
        en('You want to hear when Cropsy launches. Lovely.'),
        en('Confirm with the button, so we know this address is really yours.', true),
        button(href, 'Ja, hou me op de hoogte / Yes, keep me posted'),
        fine('Niet aangemeld? Negeer deze mail; zonder bevestiging sturen we je niets.'),
        fine('Didn’t sign up? Ignore this mail; without confirmation we send you nothing.'),
      ].join('\n'),
    ),
  )
}

/** The link that has to be in every mail we send to this list. */
export const unsubscribeUrl = (email: string) =>
  `${SITE.replace('https://www', 'https://api')}/api/newsletter/unsubscribe?token=${encodeURIComponent(
    sign({ email, kind: 'unsubscribe' }),
  )}`

export const configured = () => !!(url && serviceKey && secret)
