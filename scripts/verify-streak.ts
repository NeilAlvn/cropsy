// Streak rules, fixture-checked for Dart parity.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { computeStreak, DEFAULT_STREAK, type StreakParams } from '../src/timing/streak.ts'

interface Case { name: string; active: string[]; today: string; params: StreakParams }
const cases: Case[] = [
  { name: 'five straight days', active: ['2027-05-01', '2027-05-02', '2027-05-03', '2027-05-04', '2027-05-05'], today: '2027-05-05', params: DEFAULT_STREAK },
  { name: 'one gap bridged by a freeze', active: ['2027-05-01', '2027-05-02', '2027-05-04', '2027-05-05'], today: '2027-05-05', params: DEFAULT_STREAK },
  { name: 'three gaps in a month: third breaks it', active: ['2027-05-01', '2027-05-03', '2027-05-05', '2027-05-07', '2027-05-08'], today: '2027-05-08', params: DEFAULT_STREAK },
  { name: 'today not yet done keeps the streak open', active: ['2027-05-03', '2027-05-04'], today: '2027-05-05', params: DEFAULT_STREAK },
  { name: 'premium: unlimited freezes', active: ['2027-05-01', '2027-05-05', '2027-05-09'], today: '2027-05-09', params: { freezesPerMonth: Infinity, pausedMonths: [] } },
  { name: 'winter pause bridges December', active: ['2027-11-30', '2028-01-02', '2028-01-03'], today: '2028-01-03', params: { freezesPerMonth: 2, pausedMonths: [12] } },
  { name: 'nothing active', active: [], today: '2027-05-05', params: DEFAULT_STREAK },
  { name: 'first ever active day spends no freezes', active: ['2027-05-05'], today: '2027-05-05', params: DEFAULT_STREAK },
  { name: 'open today after a first active day yesterday', active: ['2027-05-04'], today: '2027-05-05', params: DEFAULT_STREAK },
]
const fixture = { cases: cases.map((c) => ({ ...c, params: { ...c.params, freezesPerMonth: c.params.freezesPerMonth === Infinity ? null : c.params.freezesPerMonth }, result: computeStreak(c.active, c.today, c.params) })) }
const r = (i: number) => fixture.cases[i]!.result
const checks: [string, boolean][] = [
  ['five', r(0).count === 5 && !r(0).todayOpen],
  ['one freeze → 4', r(1).count === 4 && r(1).freezesUsed['2027-05'] === 1],
  ['third gap breaks → counts 07,08 + 06 frozen + 05 + 04 frozen + 03 → then 02 breaks', r(2).count === 4],
  ['open today', r(3).count === 2 && r(3).todayOpen],
  ['premium bridges everything', r(4).count === 3],
  ['winter pause', r(5).count === 3],
  ['empty', r(6).count === 0 && r(6).todayOpen && Object.keys(r(6).freezesUsed).length === 0],
  ['first day, no freezes spent', r(7).count === 1 && Object.keys(r(7).freezesUsed).length === 0],
  ['yesterday only, today open, no freezes spent', r(8).count === 1 && r(8).todayOpen && Object.keys(r(8).freezesUsed).length === 0],
]
const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'fixtures')
writeFileSync(join(dir, 'streak.fixture.json'), JSON.stringify(fixture, null, 2) + '\n')
let failed = 0
for (const [name, ok] of checks) { console.log(`${ok ? '✓' : '✗'} ${name}`); if (!ok) failed++ }
process.exit(failed ? 1 : 0)
