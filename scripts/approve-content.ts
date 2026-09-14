// Flip drafts to verified after a human review. Sources must be live first
// (run verify:sources). Paths are relative to data/, e.g.
//   npx tsx scripts/approve-content.ts problems/aphids.json content/crops/tomato.nl.md varieties/tomato.json
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
for (const rel of process.argv.slice(2)) {
  const path = join(here, '..', 'data', rel)
  const text = readFileSync(path, 'utf8')
  if (rel.endsWith('.md')) {
    if (!/^sources:\n  - /m.test(text)) { console.log(`✗ ${rel}: no sources, not approving`); continue }
    writeFileSync(path, text.replace(/^verified:\s*false$/m, 'verified: true'))
  } else {
    const v = JSON.parse(text)
    const rows = Array.isArray(v) ? v : [v]
    if (rows.some((r) => !(r.sources?.length))) { console.log(`✗ ${rel}: a row has no sources, not approving`); continue }
    for (const r of rows) r.verified = true
    writeFileSync(path, JSON.stringify(v, null, 2) + '\n')
  }
  console.log(`✓ ${rel} verified`)
}
console.log('Next: npm run snapshot && git commit')
