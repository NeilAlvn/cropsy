// GET /api/cron/seasonal — runs every morning, sends on about five days a year.
//
// Vercel's scheduler calls this with `Authorization: Bearer $CRON_SECRET`.
// Without that header it answers 401, because a public URL that mails every
// opted-in grower is a URL someone else will press.
import { configured } from '../../../../src/server/newsletter'
import {
  alreadySent,
  dueToday,
  harvestRecap,
  markSent,
  recap,
  recipients,
  seasonOpener,
  send,
} from '../../../../src/server/seasonal'

const cronSecret = process.env.CRON_SECRET

export async function GET(request: Request): Promise<Response> {
  // Both, before anything is sent: every mail below carries an unsubscribe
  // link, and a link that cannot be signed is a mail that cannot be stopped.
  if (!cronSecret || !configured()) return new Response('server not configured', { status: 500 })
  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response('unauthorized', { status: 401 })
  }

  const now = new Date()
  const kind = dueToday(now)
  if (!kind) return Response.json({ sent: 0, reason: 'not a send day' })

  const year = now.getUTCFullYear()
  if (await alreadySent(kind, year)) return Response.json({ sent: 0, reason: 'already sent' })

  let sent = 0
  if (kind === 'season_opener') {
    for (const r of await recipients()) {
      const { subject, html } = seasonOpener(r)
      if (await send(r.email, subject, html)) sent++
    }
  } else {
    // Only growers who actually harvested something: `season_recap` returns no
    // row for an empty year, and an empty recap is worse than no recap.
    for (const r of await recap(year)) {
      const { subject, html } = harvestRecap(r, year)
      if (await send(r.email, subject, html)) sent++
    }
  }

  await markSent(kind, year, sent)
  return Response.json({ sent, kind, year })
}
