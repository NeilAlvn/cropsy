// DELETE /api/account — delete the calling user (PRD 8.2 "Delete account").
//
// The client sends its own Supabase JWT. We verify it against Supabase Auth,
// then delete that user with the service-role key, which must never ship in
// the app — hence a server route. auth.users cascades to every owned row
// (0001/0002 FKs are `on delete cascade`). Plain fetch: no SDK needed.

import { send, deletionReceipt } from '../../../src/server/email'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function DELETE(request: Request): Promise<Response> {
  if (!url || !serviceKey) return new Response('server not configured', { status: 500 })
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 })

  const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: auth } })
  if (!me.ok) return new Response('unauthorized', { status: 401 })
  // Read the address before the delete: afterwards there is no row to ask.
  const { id, email } = (await me.json()) as { id: string; email?: string }

  const del = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
  })
  if (!del.ok) return new Response('delete failed', { status: 502 })

  // Receipt for the one irreversible action in the product. Deliberately not
  // awaited for its result: the account is gone either way, and a mail outage
  // must not turn a successful delete into a 502 the app would retry.
  if (email) {
    const { subject, html } = deletionReceipt()
    await send(email, subject, html)
  }
  return new Response(null, { status: 204 })
}
