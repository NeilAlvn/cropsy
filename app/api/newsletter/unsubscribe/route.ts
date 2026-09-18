// GET /api/newsletter/unsubscribe?token=… — the link at the foot of every mail
// we send to this list. No login, no confirmation step: one click has to be
// enough, or it is not really an unsubscribe.
import { SITE, markUnsubscribed, verify } from '../../../../src/server/newsletter'

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const claims = verify(token)
  const locale = claims?.locale === 'en' ? 'en' : 'nl'
  if (!claims || claims.kind !== 'unsubscribe' || typeof claims.email !== 'string') {
    return Response.redirect(`${SITE}/${locale}/newsletter?state=expired`, 303)
  }
  const done = await markUnsubscribed(claims.email)
  return Response.redirect(`${SITE}/${locale}/newsletter?state=${done ? 'unsubscribed' : 'error'}`, 303)
}
