// POST /api/newsletter/subscribe — the website's launch-list form.
//
// Answers the same way whether or not the address is already on the list: the
// endpoint is public, and telling a stranger "already subscribed" would turn
// it into a way to test whether someone signed up.
import {
  configured,
  findSubscriber,
  isLocale,
  looksLikeEmail,
  recordRequest,
  sendConfirmation,
} from '../../../../src/server/newsletter'

/** How long before the same address can trigger another confirmation mail. */
const RESEND_AFTER_MS = 60 * 60 * 1000

const ok = () => Response.json({ ok: true })

export async function POST(request: Request): Promise<Response> {
  if (!configured()) return new Response('server not configured', { status: 500 })

  const body = (await request.json().catch(() => null)) as { email?: unknown; locale?: unknown } | null
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const locale = isLocale(body?.locale) ? body.locale : 'nl'
  if (!looksLikeEmail(email)) return Response.json({ ok: false, error: 'email' }, { status: 400 })

  const existing = await findSubscriber(email)
  if (existing?.confirmed_at && !existing.unsubscribed_at) return ok()

  // Throttle: without this the form mails a stranger's inbox as often as
  // someone cares to press the button.
  if (existing && Date.now() - Date.parse(existing.requested_at) < RESEND_AFTER_MS) return ok()

  if (!(await recordRequest(email, locale))) return new Response('store failed', { status: 502 })
  await sendConfirmation(email, locale)
  return ok()
}
