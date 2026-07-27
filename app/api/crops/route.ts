// GET /api/crops — the crop rule table (API-CONTRACT §2).
//
// The snapshot is generated at build time (scripts/build-snapshot.ts) and
// imported, not read from disk per request: the data only changes when we ship,
// so there is nothing to look up at runtime.
//
// Cache negotiation is plain HTTP. `version` is a content hash, so it doubles as
// a strong ETag — a client that already has the current table gets a 304 and
// downloads nothing. `?version=` is offered too, because the Flutter client
// stores the version anyway and an explicit check is easier to reason about
// on-device than header plumbing.

import snapshot from '../../../generated/crops-snapshot.json'

// Deliberately NOT force-static: this handler reads the request's
// If-None-Match header to answer 304, which a prerendered response can't do.
// The payload is 62 kB and the 304 path makes repeat calls nearly free.

export async function GET(request: Request): Promise<Response> {
  const etag = `"${snapshot.version}"`
  const url = new URL(request.url)
  const clientVersion = url.searchParams.get('version')
  const ifNoneMatch = request.headers.get('if-none-match')

  const upToDate = clientVersion === snapshot.version || ifNoneMatch === etag
  if (upToDate) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' },
    })
  }

  return Response.json(snapshot, {
    headers: { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' },
  })
}
