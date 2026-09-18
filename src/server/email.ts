// Transactional mail through Resend's HTTP API.
//
// Plain fetch, like every other vendor in this codebase — the SDK would be a
// dependency for one POST. Sending domain `send.cropsyapp.com` is verified in
// Resend's eu-west-1 region, so addresses stay in the EU; people reply to the
// mailbox, not to the sender.
//
// Every mail here is transactional: it answers something the person just did.
// Season mail and the harvest recap are not — those carry consent and an
// unsubscribe link, and live apart from this file.

const key = process.env.RESEND_API_KEY

const SITE = 'https://www.cropsyapp.com'
const FROM = 'Cropsy <post@send.cropsyapp.com>'
const REPLY_TO = 'hello@cropsyapp.com'

/**
 * Cropsy's mail shell: the same paper background, mascot and bilingual shape as
 * the Supabase auth templates in `supabase/templates/`. NL first, EN under it —
 * the app ships both and mail cannot ask which one you read.
 *
 * The mascot is served from the website (`public/mail/`) because mail clients
 * refuse inline images; `pose` is one of those filenames.
 */
export function layout(pose: string, alt: string, body: string): string {
  return `<!doctype html>
<html lang="nl">
<body style="margin:0;background:#f4f1ea;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1f2a1f">
    <div style="max-width:480px;margin:0 auto;padding:40px 24px">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
        <tr>
          <td style="padding-right:12px"><img src="${SITE}/mail/${pose}.png" width="72" height="72" alt="${alt}" style="display:block;width:72px;height:72px;border:0"></td>
          <td style="font-size:22px;font-weight:700;color:#1f2a1f;font-family:-apple-system,Segoe UI,Roboto,sans-serif">Cropsy</td>
        </tr>
      </table>
${body}
    </div>
</body>
</html>`
}

export const nl = (text: string, last = false) =>
  `      <p style="font-size:16px;line-height:1.5;margin:0 0 ${last ? '14px' : '4px'}">${text}</p>`

export const en = (text: string, last = false) =>
  `      <p style="font-size:14px;line-height:1.5;color:#5a6a5a;margin:0 0 ${last ? '24px' : '4px'}">${text}</p>`

export const button = (href: string, label: string) =>
  `      <p style="margin:0 0 32px"><a href="${href}" style="display:inline-block;background:#2f6b3a;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:600">${label}</a></p>`

export const fine = (text: string) =>
  `      <p style="font-size:12px;color:#8a948a;line-height:1.5;margin:0 0 4px">${text}</p>`

/**
 * Send one mail. Returns false when mail is not configured or Resend refused —
 * it never throws. A receipt failing must not fail the action it is reporting
 * on: the account is already deleted either way.
 */
export async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!key) return false
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, reply_to: REPLY_TO }),
  }).catch(() => null)
  return !!r?.ok
}

/**
 * Account deletion receipt (PRD 8.2). The only irreversible action in the
 * product, so it gets a paper trail: if this arrives and you did not ask for
 * it, someone else was in your account.
 */
export function deletionReceipt(): { subject: string; html: string } {
  return {
    subject: 'Je Cropsy-account is verwijderd / Your Cropsy account is deleted',
    html: layout(
      'sleeping',
      'Het Cropsy-plantje slaapt',
      [
        nl('Je account is weg, en alles wat erin stond: tuinen, planten, logboek, foto\u2019s en oogsten.'),
        nl('We bewaren geen kopie, dus er valt niets terug te zetten. Het plantje gaat slapen.', true),
        en('Your account is gone, and everything in it: gardens, plants, journal, photos and harvests.'),
        en('We keep no copy, so there is nothing to restore. The little plant goes to sleep.', true),
        nl('Zin om opnieuw te beginnen? Open de app en maak een nieuwe tuin.'),
        en('Fancy starting over? Open the app and make a new garden.', true),
        fine('Heb je dit niet zelf gedaan? Mail ons meteen op hello@cropsyapp.com.'),
        fine('Didn\u2019t do this yourself? Write to hello@cropsyapp.com straight away.'),
      ].join('\n'),
    ),
  }
}
