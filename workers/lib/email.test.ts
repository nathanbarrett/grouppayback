import { it, expect } from 'vitest'
import { buildSaveEmail, buildShareUrl } from './email'
it('renders approved email safely using only the canonical share origin', () => {
  const url = buildShareUrl('01ARZ3NDEKTSV4RRFFQ69G5FAV')
  expect(url).toBe('https://grouppayback.com/?u=01ARZ3NDEKTSV4RRFFQ69G5FAV')
  expect(() => buildShareUrl('bad')).toThrow()
  const email = buildSaveEmail({ title: '<Trip & friends>', id: '01ARZ3NDEKTSV4RRFFQ69G5FAV' })
  expect(email.html).toContain('&lt;Trip &amp; friends&gt;')
  expect(email.html).not.toContain('<Trip')
  expect(email.html).toContain('Your event is saved.')
  expect(email.html).toContain('Open your event')
  expect(email.html).not.toMatch(/example.com|<script/i)
  expect(email.html).toContain('No newsletters, no account, nothing to verify.')
  expect(email.text).toContain('No newsletters, no account, nothing to verify.')
  expect(email.text).toContain('<Trip & friends>')
  expect(email.text).toContain(url)
  expect(email.subject).toBe('Your GroupPayback link for "<Trip & friends>"')
})
