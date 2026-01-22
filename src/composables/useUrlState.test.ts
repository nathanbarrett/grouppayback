import { describe, it, expect } from 'vitest'
import { _testing } from './useUrlState'
import type { AppState } from '../types'

const { toCompact, fromCompact, encodeState, decodeState } = _testing

describe('URL State Encoding', () => {
  describe('toCompact', () => {
    it('converts full state to compact format', () => {
      const state: AppState = {
        people: [
          {
            id: 'abc123',
            name: 'Alice',
            items: [
              { id: 'xyz789', name: 'Dinner', amountCents: 2500 }
            ]
          }
        ]
      }

      const compact = toCompact(state)

      expect(compact).toEqual({
        p: [
          {
            i: 'abc123',
            n: 'Alice',
            t: [
              { i: 'xyz789', n: 'Dinner', a: 2500 }
            ]
          }
        ]
      })
    })

    it('includes currency when present', () => {
      const state: AppState = {
        people: [{ id: 'p1', name: 'Bob', items: [] }],
        currency: '€'
      }

      const compact = toCompact(state)

      expect(compact.c).toBe('€')
    })

    it('omits currency when undefined', () => {
      const state: AppState = {
        people: [{ id: 'p1', name: 'Bob', items: [] }]
      }

      const compact = toCompact(state)

      expect(compact.c).toBeUndefined()
    })

    it('handles multiple people with multiple items', () => {
      const state: AppState = {
        people: [
          {
            id: 'p1',
            name: 'Alice',
            items: [
              { id: 'i1', name: 'Dinner', amountCents: 5000 },
              { id: 'i2', name: 'Taxi', amountCents: 1500 }
            ]
          },
          {
            id: 'p2',
            name: 'Bob',
            items: [
              { id: 'i3', name: 'Drinks', amountCents: 2000 }
            ]
          }
        ]
      }

      const compact = toCompact(state)

      expect(compact.p).toHaveLength(2)
      expect(compact.p[0]!.t).toHaveLength(2)
      expect(compact.p[1]!.t).toHaveLength(1)
    })
  })

  describe('fromCompact', () => {
    it('converts compact format back to full state', () => {
      const compact = {
        p: [
          {
            i: 'abc123',
            n: 'Alice',
            t: [
              { i: 'xyz789', n: 'Dinner', a: 2500 }
            ]
          }
        ]
      }

      const state = fromCompact(compact)

      expect(state).toEqual({
        people: [
          {
            id: 'abc123',
            name: 'Alice',
            items: [
              { id: 'xyz789', name: 'Dinner', amountCents: 2500 }
            ]
          }
        ]
      })
    })

    it('includes currency when present in compact', () => {
      const compact = {
        p: [{ i: 'p1', n: 'Bob', t: [] }],
        c: '£'
      }

      const state = fromCompact(compact)

      expect(state.currency).toBe('£')
    })

    it('omits currency when not in compact', () => {
      const compact = {
        p: [{ i: 'p1', n: 'Bob', t: [] }]
      }

      const state = fromCompact(compact)

      expect(state.currency).toBeUndefined()
    })
  })

  describe('roundtrip: toCompact -> fromCompact', () => {
    it('preserves state through roundtrip', () => {
      const original: AppState = {
        people: [
          {
            id: 'person1',
            name: 'Alice',
            items: [
              { id: 'item1', name: 'Dinner', amountCents: 5000 },
              { id: 'item2', name: 'Taxi', amountCents: 1500 }
            ]
          },
          {
            id: 'person2',
            name: 'Bob',
            items: [
              { id: 'item3', name: 'Drinks', amountCents: 2000 }
            ]
          }
        ],
        currency: '€'
      }

      const roundtripped = fromCompact(toCompact(original))

      expect(roundtripped).toEqual(original)
    })
  })

  describe('encodeState', () => {
    it('produces a base64-encoded string', () => {
      const state: AppState = {
        people: [{ id: 'p1', name: 'Test', items: [] }]
      }

      const encoded = encodeState(state)

      // Should be valid base64 (no errors when decoding)
      expect(() => atob(encoded)).not.toThrow()
    })

    it('produces shorter output than full JSON', () => {
      const state: AppState = {
        people: [
          {
            id: 'abc123',
            name: 'Alice',
            items: [
              { id: 'xyz789', name: 'Dinner', amountCents: 2500 }
            ]
          }
        ]
      }

      const encoded = encodeState(state)
      const fullJson = JSON.stringify(state)
      const fullEncoded = btoa(encodeURIComponent(fullJson))

      expect(encoded.length).toBeLessThan(fullEncoded.length)
    })

    it('excludes default currency ($) from encoded output', () => {
      const state: AppState = {
        people: [{ id: 'p1', name: 'Test', items: [] }],
        currency: '$'
      }

      const encoded = encodeState(state)
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)))

      expect(decoded.c).toBeUndefined()
    })

    it('includes non-default currency in encoded output', () => {
      const state: AppState = {
        people: [{ id: 'p1', name: 'Test', items: [] }],
        currency: '€'
      }

      const encoded = encodeState(state)
      const decoded = JSON.parse(decodeURIComponent(atob(encoded)))

      expect(decoded.c).toBe('€')
    })
  })

  describe('decodeState', () => {
    it('decodes compact format correctly', () => {
      const state: AppState = {
        people: [
          {
            id: 'p1',
            name: 'Alice',
            items: [{ id: 'i1', name: 'Lunch', amountCents: 1500 }]
          }
        ]
      }

      const encoded = encodeState(state)
      const decoded = decodeState(encoded)

      expect(decoded).toEqual(state)
    })

    it('handles backward compatibility with old format (full keys)', () => {
      const oldFormatState = {
        people: [
          {
            id: 'p1',
            name: 'Alice',
            items: [{ id: 'i1', name: 'Lunch', amountCents: 1500 }]
          }
        ],
        currency: '€'
      }

      // Encode in old format (without compact conversion)
      const oldEncoded = btoa(encodeURIComponent(JSON.stringify(oldFormatState)))
      const decoded = decodeState(oldEncoded)

      expect(decoded).toEqual(oldFormatState)
    })

    it('returns null for invalid base64', () => {
      const decoded = decodeState('not-valid-base64!!!')

      expect(decoded).toBeNull()
    })

    it('returns null for valid base64 but invalid JSON', () => {
      const encoded = btoa('not json at all')
      const decoded = decodeState(encoded)

      expect(decoded).toBeNull()
    })

    it('returns null for valid JSON but missing people/p array', () => {
      const encoded = btoa(encodeURIComponent(JSON.stringify({ foo: 'bar' })))
      const decoded = decodeState(encoded)

      expect(decoded).toBeNull()
    })
  })

  describe('full roundtrip: encodeState -> decodeState', () => {
    it('preserves state through full encode/decode cycle', () => {
      const original: AppState = {
        people: [
          {
            id: 'person1',
            name: 'Alice',
            items: [
              { id: 'item1', name: 'Dinner', amountCents: 5000 },
              { id: 'item2', name: 'Taxi ride home', amountCents: 1575 }
            ]
          },
          {
            id: 'person2',
            name: 'Bob',
            items: [
              { id: 'item3', name: 'Drinks at bar', amountCents: 2350 }
            ]
          },
          {
            id: 'person3',
            name: 'Charlie',
            items: []
          }
        ],
        currency: '£'
      }

      const encoded = encodeState(original)
      const decoded = decodeState(encoded)

      expect(decoded).toEqual(original)
    })

    it('handles empty items array', () => {
      const original: AppState = {
        people: [
          { id: 'p1', name: 'Alice', items: [] },
          { id: 'p2', name: 'Bob', items: [] }
        ]
      }

      const decoded = decodeState(encodeState(original))

      expect(decoded).toEqual(original)
    })

    it('handles special characters in names', () => {
      const original: AppState = {
        people: [
          {
            id: 'p1',
            name: 'José García',
            items: [
              { id: 'i1', name: 'Café & croissant', amountCents: 850 }
            ]
          }
        ]
      }

      const decoded = decodeState(encodeState(original))

      expect(decoded).toEqual(original)
    })

    it('handles unicode currency symbols', () => {
      const currencies = ['€', '£', '¥', '₹', '₩', '₽']

      for (const currency of currencies) {
        const original: AppState = {
          people: [{ id: 'p1', name: 'Test', items: [] }],
          currency
        }

        const decoded = decodeState(encodeState(original))

        expect(decoded?.currency).toBe(currency)
      }
    })

    it('handles zero amounts', () => {
      const original: AppState = {
        people: [
          {
            id: 'p1',
            name: 'Alice',
            items: [{ id: 'i1', name: 'Free item', amountCents: 0 }]
          }
        ]
      }

      const decoded = decodeState(encodeState(original))

      expect(decoded!.people[0]!.items[0]!.amountCents).toBe(0)
    })

    it('handles large amounts', () => {
      const original: AppState = {
        people: [
          {
            id: 'p1',
            name: 'Alice',
            items: [{ id: 'i1', name: 'Expensive item', amountCents: 99999999 }]
          }
        ]
      }

      const decoded = decodeState(encodeState(original))

      expect(decoded!.people[0]!.items[0]!.amountCents).toBe(99999999)
    })
  })

  describe('URL size reduction', () => {
    it('achieves significant size reduction for typical data', () => {
      const state: AppState = {
        people: [
          {
            id: 'abc1234',
            name: 'Alice',
            items: [
              { id: 'item001', name: 'Dinner', amountCents: 5000 },
              { id: 'item002', name: 'Taxi', amountCents: 1500 },
              { id: 'item003', name: 'Drinks', amountCents: 2000 }
            ]
          },
          {
            id: 'def5678',
            name: 'Bob',
            items: [
              { id: 'item004', name: 'Lunch', amountCents: 3000 },
              { id: 'item005', name: 'Coffee', amountCents: 500 },
              { id: 'item006', name: 'Snacks', amountCents: 800 }
            ]
          }
        ],
        currency: '€'
      }

      // Old format (full keys)
      const oldFormat = JSON.stringify(state)
      const oldEncoded = btoa(encodeURIComponent(oldFormat))

      // New format (compact keys)
      const newEncoded = encodeState(state)

      const reduction = ((oldEncoded.length - newEncoded.length) / oldEncoded.length) * 100

      // Should achieve at least 10% reduction (actual is ~15%)
      expect(reduction).toBeGreaterThan(10)
      // Verify new encoding is shorter
      expect(newEncoded.length).toBeLessThan(oldEncoded.length)
    })
  })
})
