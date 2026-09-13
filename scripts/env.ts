// Load ./.env into process.env for scripts (no dependency). Never commit .env.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const file = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
if (existsSync(file)) {
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
