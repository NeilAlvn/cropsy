// Index page. Exists so the deployment root isn't a 404, and so the endpoints
// are discoverable to anyone (including us, in six months) who opens the URL.

const ENDPOINTS = [
  { method: 'GET', path: '/api/crops', note: 'crop rule table + version' },
  { method: 'GET', path: '/api/frost?lat=&lon=', note: 'last/first frost dates' },
  { method: 'POST', path: '/api/schedule/weather-adjust', note: 'task deltas from live weather' },
]

export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', lineHeight: 1.6 }}>
      <h1>Growit API</h1>
      <p>Backend for the crop timing engine. See docs/API-CONTRACT.md.</p>
      <ul>
        {ENDPOINTS.map((e) => (
          <li key={e.path}>
            <code>
              {e.method} {e.path}
            </code>{' '}
            — {e.note}
          </li>
        ))}
      </ul>
    </main>
  )
}
