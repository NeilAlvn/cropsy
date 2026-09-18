// GET /api/newsletter/confirm?token=… — the button in the confirmation mail.
//
// The token is HMAC-signed and carries the address, so there is no id to guess
// and nothing to look up before the signature checks out.
import { SITE, markConfirmed, verify } from '../../../../src/server/newsletter'

const back = (locale: string, state: string) =>
  Response.redirect(`${SITE}/${locale}/newsletter?state=${state}`, 303)

export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const claims = verify(token)
  const locale = claims?.locale === 'en' ? 'en' : 'nl'
  if (!claims || claims.kind !== 'confirm' || typeof claims.email !== 'string') {
    return back(locale, 'expired')
  }
  return back(locale, (await markConfirmed(claims.email)) ? 'confirmed' : 'error')
}
