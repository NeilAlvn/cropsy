// Server-side user context for the paid proxies: who is calling, are they
// premium, and how many calls they made today. Service-role key stays here.

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const rcSecret = process.env.REVENUECAT_SECRET_KEY

export interface Caller {
  id: string
  premium: boolean
}

export async function caller(request: Request): Promise<Caller | Response> {
  if (!url || !serviceKey) return new Response('server not configured', { status: 500 })
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 })
  const me = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: auth } })
  if (!me.ok) return new Response('unauthorized', { status: 401 })
  const { id } = (await me.json()) as { id: string }
  return { id, premium: await isPremium(id) }
}

async function isPremium(id: string): Promise<boolean> {
  if (!rcSecret) return false
  const rc = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${rcSecret}` },
  })
  if (!rc.ok) return false
  const body = (await rc.json()) as { subscriber?: { entitlements?: Record<string, { expires_date: string | null }> } }
  const ent = body.subscriber?.entitlements?.premium
  return !!ent && (ent.expires_date === null || new Date(ent.expires_date) > new Date())
}

/** Count one call; returns today's total (1 = first call today). */
export async function bumpUsage(id: string, kind: 'identify' | 'diagnose'): Promise<number> {
  const r = await fetch(`${url}/rest/v1/rpc/bump_api_usage`, {
    method: 'POST',
    headers: { apikey: serviceKey!, authorization: `Bearer ${serviceKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_owner: id, p_kind: kind }),
  })
  if (!r.ok) return 1 // counting failed: let the call through rather than block a paying user
  return (await r.json()) as number
}

/** Read the multipart image from the request. */
export async function imageFrom(request: Request): Promise<{ bytes: Blob; name: string } | Response> {
  const form = await request.formData().catch(() => null)
  const file = form?.get('image')
  if (!(file instanceof Blob) || file.size === 0) return new Response('image missing', { status: 400 })
  if (file.size > 8 * 1024 * 1024) return new Response('image too large (max 8 MB)', { status: 413 })
  return { bytes: file, name: (file as File).name || 'photo.jpg' }
}
