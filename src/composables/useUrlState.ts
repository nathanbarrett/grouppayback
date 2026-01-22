import { ref, watch, computed } from 'vue'
import type { AppState } from '../types'

// Compact types for URL encoding (reduces URL length by ~40%)
interface CompactLineItem {
  i: string      // id
  n: string      // name
  a: number      // amountCents
}

interface CompactPerson {
  i: string            // id
  n: string            // name
  t: CompactLineItem[] // items (using 't' since 'i' is for id)
}

interface CompactState {
  p: CompactPerson[]   // people
  c?: string           // currency
}

export const CURRENCIES = [
  { symbol: '$', name: 'Dollar' },
  { symbol: '€', name: 'Euro' },
  { symbol: '£', name: 'Pound' },
  { symbol: '¥', name: 'Yen/Yuan' },
  { symbol: '₹', name: 'Rupee' },
  { symbol: '₩', name: 'Won' },
  { symbol: 'R$', name: 'Real' },
  { symbol: 'CHF', name: 'Franc' },
  { symbol: 'kr', name: 'Krona' },
  { symbol: '₽', name: 'Ruble' },
]

const DEFAULT_CURRENCY = '$'

function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

function toCompact(state: AppState): CompactState {
  return {
    p: state.people.map(person => ({
      i: person.id,
      n: person.name,
      t: person.items.map(item => ({
        i: item.id,
        n: item.name,
        a: item.amountCents
      }))
    })),
    ...(state.currency && { c: state.currency })
  }
}

function fromCompact(compact: CompactState): AppState {
  return {
    people: compact.p.map(person => ({
      id: person.i,
      name: person.n,
      items: person.t.map(item => ({
        id: item.i,
        name: item.n,
        amountCents: item.a
      }))
    })),
    ...(compact.c && { currency: compact.c })
  }
}

function encodeState(state: AppState): string {
  // Only include currency in URL if it's not the default
  const stateToEncode = { ...state }
  if (!stateToEncode.currency || stateToEncode.currency === DEFAULT_CURRENCY) {
    delete stateToEncode.currency
  }
  // Convert to compact format for shorter URLs
  const compact = toCompact(stateToEncode)
  const json = JSON.stringify(compact)
  return btoa(encodeURIComponent(json))
}

function decodeState(encoded: string): AppState | null {
  try {
    const json = decodeURIComponent(atob(encoded))
    const parsed = JSON.parse(json)

    // Check for old format (has 'people' key)
    if (parsed && Array.isArray(parsed.people)) {
      return parsed as AppState
    }

    // Check for compact format (has 'p' key)
    if (parsed && Array.isArray(parsed.p)) {
      return fromCompact(parsed as CompactState)
    }

    return null
  } catch {
    return null
  }
}

function getStateFromUrl(): AppState | null {
  const params = new URLSearchParams(window.location.search)
  const data = params.get('data')
  if (data) {
    return decodeState(data)
  }
  return null
}

function hasUserData(state: AppState): boolean {
  return state.people.some(person =>
    person.name.trim() !== '' ||
    person.items.some(item => item.name.trim() !== '' || item.amountCents > 0)
  )
}

function updateUrl(state: AppState): void {
  const url = new URL(window.location.href)

  if (hasUserData(state)) {
    const encoded = encodeState(state)
    url.searchParams.set('data', encoded)
  } else {
    url.searchParams.delete('data')
  }

  // Remove trailing slash before query params (e.g., /? -> ?)
  let urlString = url.toString().replace(/\/\?/, '?')
  // Remove trailing ? if no params
  urlString = urlString.replace(/\?$/, '')
  window.history.replaceState({}, '', urlString)
}

function createDefaultState(): AppState {
  return {
    people: [
      { id: generateId(), name: '', items: [] }
    ]
  }
}

export function useUrlState() {
  const initialState = getStateFromUrl() ?? createDefaultState()
  const state = ref<AppState>(initialState)

  const currency = computed(() => state.value.currency || DEFAULT_CURRENCY)

  watch(state, (newState) => {
    updateUrl(newState)
  }, { deep: true, immediate: true })

  function addPerson(): void {
    state.value.people.push({
      id: generateId(),
      name: '',
      items: []
    })
  }

  function removePerson(personId: string): void {
    const index = state.value.people.findIndex(p => p.id === personId)
    if (index !== -1) {
      state.value.people.splice(index, 1)
    }
  }

  function updatePersonName(personId: string, name: string): void {
    const person = state.value.people.find(p => p.id === personId)
    if (person) {
      person.name = name
    }
  }

  function addLineItem(personId: string): void {
    const person = state.value.people.find(p => p.id === personId)
    if (person) {
      person.items.push({
        id: generateId(),
        name: '',
        amountCents: 0
      })
    }
  }

  function removeLineItem(personId: string, itemId: string): void {
    const person = state.value.people.find(p => p.id === personId)
    if (person) {
      const index = person.items.findIndex(i => i.id === itemId)
      if (index !== -1) {
        person.items.splice(index, 1)
      }
    }
  }

  function updateLineItem(
    personId: string,
    itemId: string,
    updates: { name?: string; amountCents?: number }
  ): void {
    const person = state.value.people.find(p => p.id === personId)
    if (person) {
      const item = person.items.find(i => i.id === itemId)
      if (item) {
        if (updates.name !== undefined) item.name = updates.name
        if (updates.amountCents !== undefined) item.amountCents = updates.amountCents
      }
    }
  }

  function setCurrency(symbol: string): void {
    state.value.currency = symbol === DEFAULT_CURRENCY ? undefined : symbol
  }

  function reset(): void {
    state.value = createDefaultState()
  }

  return {
    state,
    currency,
    addPerson,
    removePerson,
    updatePersonName,
    addLineItem,
    removeLineItem,
    updateLineItem,
    setCurrency,
    reset
  }
}

// Export internal functions for testing
export const _testing = {
  toCompact,
  fromCompact,
  encodeState,
  decodeState,
}
