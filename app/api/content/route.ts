// GET /api/content — collections, monthly checklist, prices (PRD §8.1, §10).
// Same cache negotiation as /api/crops: version is a content hash = ETag.
import snapshot from '../../../generated/content-snapshot.json'

export async function GET(request: Request): Promise<Response> {
  const etag = `"${snapshot.version}"`
  const clientVersion = new URL(request.url).searchParams.get('version')
  const headers = { ETag: etag, 'Cache-Control': 'public, max-age=0, must-revalidate' }
  if (clientVersion === snapshot.version || request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers })
  }
  return Response.json(snapshot, { headers })
}
