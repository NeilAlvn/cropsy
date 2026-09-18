// Seasonal mail: the two sends a year that reach someone who is not opening the
// app — the only channel left once notifications are off or the app is gone.
//
// PRD §3's headline metric is July MAU against March MAU, and the user "forgets
// the app exists in August". February's mail is aimed squarely at that; the
// October recap closes the season rather than letting it trail off.
//
// Consent is `profiles.preferences.mail_optin`, set by the Settings toggle. No
// opt-in, no mail — and every mail carries a one-click way out.

import { layout, nl, en, button, fine, send } from './email'
import { sign, verify, SITE } from './newsletter'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export type Kind = 'season_opener' | 'harvest_recap'

export interface Recipient {
  id: string
  email: string
  lang: 'nl' | 'en'
}

export interface Recap extends Recipient {
  harvests: number
  kg: number
  pieces: number
  crops: number
  top_crop: string | null
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T[]> {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: serviceKey!,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  })
  if (!r.ok) return []
  return (await r.json()) as T[]
}

export const recipients = () => rpc<Recipient>('mail_recipients')
export const recap = (year: number) => rpc<Recap>('season_recap', { p_year: year })
export const optOut = (id: string) => rpc('mail_optout', { p_id: id })

/**
 * Which mail, if any, today's run should send. Pure so the windows can be
 * tested without waiting a year.
 *
 * Late February is roughly three weeks before sowing starts in the Netherlands;
 * mid-October is after the last outdoor harvests and before anyone has stopped
 * caring. Both windows are a few days wide so a failed run has another chance,
 * and `mail_log` stops the second day from sending twice.
 */
export function dueToday(today: Date): Kind | null {
  const month = today.getUTCMonth() + 1
  const day = today.getUTCDate()
  if (month === 2 && day >= 20 && day <= 24) return 'season_opener'
  if (month === 10 && day >= 15 && day <= 19) return 'harvest_recap'
  return null
}

/** One-click opt-out, signed like the launch-list links. Never expires. */
export const optOutUrl = (id: string) =>
  `${SITE.replace('https://www', 'https://api')}/api/newsletter/unsubscribe?token=${encodeURIComponent(
    sign({ uid: id, kind: 'mail_optout' }),
  )}`

export const readOptOut = (token: string): string | null => {
  const claims = verify(token)
  return claims?.kind === 'mail_optout' && typeof claims.uid === 'string' ? claims.uid : null
}

const foot = (id: string, lang: 'nl' | 'en') =>
  [
    fine(
      lang === 'nl'
        ? `Geen seizoensmail meer? <a href="${optOutUrl(id)}" style="color:#5a6a5a">Uitschrijven</a> — één klik, en de app verandert niet.`
        : `No more seasonal mail? <a href="${optOutUrl(id)}" style="color:#5a6a5a">Unsubscribe</a> — one click, and nothing in the app changes.`,
    ),
  ].join('\n')

export function seasonOpener(r: Recipient): { subject: string; html: string } {
  const dutch = r.lang === 'nl'
  return {
    subject: dutch ? 'Het seizoen begint bijna' : 'The season is nearly here',
    html: layout(
      'sun',
      dutch ? 'Het Cropsy-plantje in de zon' : 'The Cropsy plant in the sun',
      [
        nl('Over een paar weken mag er weer gezaaid worden.'),
        nl('Open de app: je plan staat klaar met de data die bij jouw vorstzone horen, en je ziet meteen wat er deze maand naar binnen of naar buiten kan.', true),
        en('In a few weeks it is time to sow again.'),
        en('Open the app: your plan is waiting with the dates that match your own frost zone, and you can see straight away what goes in this month.', true),
        button(SITE, dutch ? 'Bekijk je plan' : 'See your plan'),
        foot(r.id, r.lang),
      ].join('\n'),
    ),
  }
}

export function harvestRecap(r: Recap, year: number): { subject: string; html: string } {
  const dutch = r.lang === 'nl'
  const kg = Number(r.kg)
  const pieces = Number(r.pieces)
  const amounts = [
    kg > 0 ? `${kg.toFixed(1).replace('.', dutch ? ',' : '.')} kg` : null,
    pieces > 0 ? `${pieces} ${dutch ? 'stuks' : 'pieces'}` : null,
  ].filter(Boolean).join(dutch ? ' en ' : ' and ')

  return {
    subject: dutch ? `Jouw oogstjaar ${year}` : `Your ${year} harvest`,
    html: layout(
      'celebrating',
      dutch ? 'Het Cropsy-plantje juicht' : 'The Cropsy plant cheering',
      [
        nl(`Je hebt dit jaar ${r.harvests}× geoogst, van ${r.crops} ${r.crops === 1 ? 'gewas' : 'gewassen'}${amounts ? `: samen ${amounts}` : ''}.`),
        nl(r.top_crop ? `Je trouwste gewas was ${r.top_crop}.` : 'Alles bij elkaar een seizoen om trots op te zijn.', true),
        en(`You harvested ${r.harvests} times this year, from ${r.crops} ${r.crops === 1 ? 'crop' : 'crops'}${amounts ? `: ${amounts} in total` : ''}.`),
        en(r.top_crop ? `Your most reliable crop was ${r.top_crop}.` : 'All in all, a season to be proud of.', true),
        button(SITE, dutch ? 'Plan volgend seizoen' : 'Plan next season'),
        foot(r.id, r.lang),
      ].join('\n'),
    ),
  }
}

export async function markSent(kind: Kind, year: number, count: number): Promise<void> {
  await fetch(`${url}/rest/v1/mail_log?on_conflict=kind,year`, {
    method: 'POST',
    headers: {
      apikey: serviceKey!,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ kind, year, recipients: count }),
  })
}

export async function alreadySent(kind: Kind, year: number): Promise<boolean> {
  const r = await fetch(`${url}/rest/v1/mail_log?kind=eq.${kind}&year=eq.${year}&select=kind`, {
    headers: { apikey: serviceKey!, authorization: `Bearer ${serviceKey}` },
  })
  if (!r.ok) return true // cannot tell = do not send; a double send is worse
  return ((await r.json()) as unknown[]).length > 0
}

export { send }
