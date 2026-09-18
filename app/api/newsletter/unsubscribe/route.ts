// GET /api/newsletter/unsubscribe?token=… — the link at the foot of every mail
// we send to a list. No login, no confirmation step: one click has to be
// enough, or it is not really an unsubscribe.
//
// Two kinds of token arrive here. `unsubscribe` carries a launch-list address;
// `mail_optout` carries an app user's id, and clears the consent that lives in
// their profile preferences.
import { SITE, markUnsubscribed, verify } from '../../../../src/server/newsletter'
import { optOut } from '../../../../src/server/seasonal'

const back = (locale: string, state: string) =>
  Response.redirect(`${SITE}/${locale}/newsletter?state=${state}`, 303)

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const claims = verify(token)
  const locale = claims?.locale === 'en' ? 'en' : 'nl'

  if (claims?.kind === 'unsubscribe' && typeof claims.email === 'string') {
    return back(locale, (await markUnsubscribed(claims.email)) ? 'unsubscribed' : 'error')
  }
  if (claims?.kind === 'mail_optout' && typeof claims.uid === 'string') {
    await optOut(claims.uid)
    return back(locale, 'unsubscribed')
  }
  return back(locale, 'expired')
}
