// The send windows. A mail that goes out on the wrong day is worse than one
// that does not go out at all, and the real calendar only tests this twice a
// year, so the dates are asserted here instead.
import assert from 'node:assert/strict'

process.env.NEWSLETTER_SECRET ??= 'test-secret-for-verification-only'

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

// Slugs are how the database talks, not how a mail talks.
const { cropName, harvestRecap } = await import('../src/server/seasonal')
assert.equal(cropName('tomato', 'nl'), 'Tomaat', 'a known slug uses the Dutch name')
assert.equal(cropName('tomato', 'en'), 'Tomato', 'and the English one')
assert.equal(cropName('some-unknown-crop', 'nl'), 'some unknown crop', 'an unknown slug at least loses its dashes')
assert.equal(cropName(null, 'nl'), null, 'no crop, no name')

const mail = harvestRecap(
  { id: 'x', email: 'a@b.nl', lang: 'nl', harvests: 12, kg: 4.25, pieces: 30, crops: 3, top_crop: 'tomato' },
  2027,
)
assert.match(mail.html, /tomaat/, 'the recap says the crop name, not the slug')
assert.ok(!mail.html.includes('>tomato<'), 'and does not leak the English slug into Dutch copy')
assert.match(mail.html, /4,3 kg en 30 stuks|4,2 kg en 30 stuks/, 'Dutch decimals use a comma')
assert.match(mail.html, /unsubscribe\?token=/, 'every seasonal mail carries a way out')

console.log('recap copy: 8 checks passed')
