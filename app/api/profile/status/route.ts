// GET /api/profile/status — the server's view of a user's plan (PRD §9, 8.1).
//
// The app trusts the RevenueCat SDK on-device for gating; this route exists
// for the backend-side checks (Phase 4 identify/diagnose quota) and for a
// second opinion when the SDK and the account disagree. Verifies the Supabase
// JWT, then asks RevenueCat's REST API with the secret key (server env only).

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const rcSecret = process.env.REVENUECAT_SECRET_KEY
const ENTITLEMENT = 'premium'

export async function GET(request: Request): Promise<Response> {
  if (!supabaseUrl || !serviceKey) return new Response('server not configured', { status: 500 })
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return new Response('unauthorized', { status: 401 })
  const me = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: serviceKey, authorization: auth } })
  if (!me.ok) return new Response('unauthorized', { status: 401 })
  const { id } = (await me.json()) as { id: string }

  // No RevenueCat key yet → everyone is free; never an error the app must handle.
  if (!rcSecret) return Response.json({ plan: 'free', premium: false, source: 'unconfigured' })

  const rc = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${rcSecret}` },
  })
  if (!rc.ok) return Response.json({ plan: 'free', premium: false, source: 'revenuecat-error' })
  const body = (await rc.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date: string | null; product_identifier: string }> }
  }
  const ent = body.subscriber?.entitlements?.[ENTITLEMENT]
  const active = !!ent && (ent.expires_date === null || new Date(ent.expires_date) > new Date())
  const plan = !active ? 'free' : ent!.product_identifier.includes('lifetime') ? 'lifetime' : 'yearly'
  return Response.json(
    { plan, premium: active, expires: ent?.expires_date ?? null, source: 'revenuecat' },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  )
}
