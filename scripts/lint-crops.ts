// Validate crop rules. Errors fail the build; draft warnings just report.
import { loadCrops } from './loadCrops.ts'
import { lintCrops } from '../src/timing/lint.ts'

const crops = loadCrops()
const issues = lintCrops(crops)
const errors = issues.filter((i) => i.level === 'error')

for (const i of issues) {
  if (i.level === 'error') console.log(`✗ ${i.slug}: ${i.message}`)
}

const verified = crops.filter((c) => c.verified).length
const draft = crops.length - verified
console.log(
  `\n${crops.length} crops · ${verified} verified · ${draft} draft (need grower sign-off)`,
)
if (errors.length === 0) console.log('✓ no errors')
process.exit(errors.length > 0 ? 1 : 0)
