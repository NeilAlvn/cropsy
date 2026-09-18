// The send windows. A mail that goes out on the wrong day is worse than one
// that does not go out at all, and the real calendar only tests this twice a
// year, so the dates are asserted here instead.
import assert from 'node:assert/strict'

const { dueToday } = await import('../src/server/seasonal')

const on = (iso: string) => dueToday(new Date(`${iso}T08:00:00Z`))

// February: about three weeks before sowing starts in NL.
assert.equal(on('2027-02-19'), null, 'the day before the window is quiet')
assert.equal(on('2027-02-20'), 'season_opener', 'the window opens on the 20th')
assert.equal(on('2027-02-24'), 'season_opener', 'and closes on the 24th')
assert.equal(on('2027-02-25'), null, 'the day after is quiet again')

// October: after the last outdoor harvests.
assert.equal(on('2027-10-14'), null, 'the day before the recap window is quiet')
assert.equal(on('2027-10-15'), 'harvest_recap', 'the recap window opens on the 15th')
assert.equal(on('2027-10-19'), 'harvest_recap', 'and closes on the 19th')
assert.equal(on('2027-10-20'), null, 'the day after is quiet again')

// The other 355 days send nothing.
let quiet = 0
for (let d = new Date(Date.UTC(2027, 0, 1)); d.getUTCFullYear() === 2027; d.setUTCDate(d.getUTCDate() + 1)) {
  if (dueToday(new Date(d)) === null) quiet++
}
assert.equal(quiet, 365 - 10, 'exactly ten days a year are send days')

console.log('seasonal windows: 9 checks passed')
