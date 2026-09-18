// Token check for the launch list. The confirm and unsubscribe links are the
// only credential in that flow, so this asserts the three ways one must fail:
// a forged signature, a tampered payload, and an expired claim.
import assert from 'node:assert/strict'

process.env.NEWSLETTER_SECRET ??= 'test-secret-for-verification-only'

const { sign, verify } = await import('../src/server/newsletter')

const email = 'iemand@example.nl'

// Round trip.
const good = sign({ email, locale: 'nl', kind: 'confirm', exp: Math.floor(Date.now() / 1000) + 60 })
assert.equal(verify(good)?.email, email, 'a token we just signed must verify')

// Forged signature.
const [body] = good.split('.')
assert.equal(verify(`${body}.not-a-real-signature`), null, 'a wrong signature must not verify')

// Tampered payload: swap the address, keep the signature.
const evil = Buffer.from(JSON.stringify({ email: 'aanvaller@example.com', kind: 'confirm' })).toString('base64url')
assert.equal(verify(`${evil}.${good.split('.')[1]}`), null, 'a swapped payload must not verify')

// Expired.
const old = sign({ email, kind: 'confirm', exp: Math.floor(Date.now() / 1000) - 1 })
assert.equal(verify(old), null, 'an expired token must not verify')

// Unsubscribe tokens carry no exp and stay valid: a mail from last season must
// still be unsubscribable.
assert.equal(verify(sign({ email, kind: 'unsubscribe' }))?.kind, 'unsubscribe', 'unsubscribe tokens do not expire')

console.log('newsletter tokens: 5 checks passed')
