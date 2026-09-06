import type { AppState, PaymentMethods } from '../../src/types'

export class ValidationError extends Error {
  code: string
  constructor(code: string) { super(code); this.code = code }
}
const controls = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u
function string(value: unknown, max: number, code = 'INVALID_DATA'): string {
  if (typeof value !== 'string' || value.length > max || controls.test(value)) throw new ValidationError(code)
  return value
}
export function validateEmail(value: unknown): string {
  const email = string(value, 260, 'INVALID_EMAIL').trim()
  const [local, domain] = email.split('@')
  if (email.length > 254 || !local || local.length > 64 || !domain || !/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(email)) throw new ValidationError('INVALID_EMAIL')
  return `${local}@${domain.toLowerCase()}`
}
export function validateTitle(value: unknown): string {
  const title = string(value, 100, 'INVALID_TITLE').trim()
  if (!title) throw new ValidationError('INVALID_TITLE')
  return title
}
export function validateIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) throw new ValidationError('INVALID_IDEMPOTENCY_KEY')
  return value
}
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ValidationError('INVALID_DATA')
  return value as Record<string, unknown>
}
export function sanitizeAppState(value: unknown): AppState {
  const state = object(value)
  if (!Array.isArray(state.people) || state.people.length > 200) throw new ValidationError('INVALID_DATA')
  const result: AppState = { people: state.people.map(value => {
    const p = object(value)
    if (!Array.isArray(p.items) || p.items.length > 1000) throw new ValidationError('INVALID_DATA')
    const person: AppState['people'][number] = { id: string(p.id, 200), name: string(p.name, 200), items: p.items.map(value => {
      const i = object(value)
      if (typeof i.amountCents !== 'number' || !Number.isSafeInteger(i.amountCents) || i.amountCents < 0) throw new ValidationError('INVALID_DATA')
      return { id: string(i.id, 200), name: string(i.name, 200), amountCents: i.amountCents }
    }) }
    if (p.payments !== undefined) {
      const payments = object(p.payments)
      person.payments = {}
      for (const key of ['venmo', 'zelle', 'paypal', 'cashapp', 'other'] as (keyof PaymentMethods)[]) {
        if (payments[key] !== undefined) person.payments[key] = string(payments[key], 200)
      }
    }
    return person
  }) }
  if (state.currency !== undefined) result.currency = string(state.currency, 20)
  if (state.eventName !== undefined) result.eventName = string(state.eventName, 100)
  return result
}
