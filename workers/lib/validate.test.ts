import { describe, it, expect } from 'vitest'
import { sanitizeAppState, validateEmail, validateTitle, validateIdempotencyKey, escapeHtml } from './validate'

describe('save validation and privacy', () => {
  it('validates required recipient, title and UUID without accepting header injection', () => {
    expect(validateEmail(' a@example.com ')).toBe('a@example.com')
    for (const value of ['', null, 'a@localhost', 'a@example.com\r\nBcc:x@y.com', '"a"@b.com']) expect(() => validateEmail(value)).toThrow()
    expect(validateTitle(' Trip ')).toBe('Trip')
    for (const value of ['', null, 'x'.repeat(101), 'Trip\n', 'Trip\u2028']) expect(() => validateTitle(value)).toThrow()
    expect(validateIdempotencyKey('21cfead8-9704-437c-ae9e-d8d4f546c627')).toBeTruthy()
    expect(() => validateIdempotencyKey('no')).toThrow()
    expect(escapeHtml('<&"\'>')).toBe('&lt;&amp;&quot;&#39;&gt;')
  })
  it('rebuilds nested allowlists and rejects unsafe money', () => {
    const data = { email: 'private@example.com', people: [{ id: 'p', name: 'A', email: 'private@example.com', payments: { venmo: 'abc', email: 'private@example.com' }, items: [{ id: 'i', name: 'food', amountCents: 5, email: 'private@example.com' }] }] }
    expect(JSON.stringify(sanitizeAppState(data))).not.toContain('private@')
    for (const amountCents of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => sanitizeAppState({ people: [{ id: 'p', name: 'A', items: [{ id: 'i', name: 'food', amountCents }] }] })).toThrow()
  })
})
