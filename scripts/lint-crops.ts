// Fail the build if any crop rule is bad. Run in CI once there's more data.
import { loadCrops } from './loadCrops.ts'
import { lintCrops } from '../src/timing/lint.ts'

const issues = lintCrops(loadCrops())
const errors = issues.filter((i) => i.level === 'error')

for (const i of issues) {
  console.log(`${i.level === 'error' ? '✗' : '⚠'} ${i.slug}: ${i.message}`)
}
if (issues.length === 0) console.log('✓ all crops clean')

process.exit(errors.length > 0 ? 1 : 0)
