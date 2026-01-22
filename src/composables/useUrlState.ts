import { ref, watch, computed } from 'vue'
import type { AppState, PaymentMethods } from '../types'

// Compact types for URL encoding (reduces URL length by ~40%)
interface CompactLineItem {
  i: string      // id
  n: string      // name
  a: number      // amountCents
}

interface CompactPaymentMethods {
  v?: string  // venmo
  z?: string  // zelle
  p?: string  // paypal
  a?: string  // cashapp (a for "app")
  o?: string  // other
}

interface CompactPerson {
  i: string            // id
  n: string            // name
  t: CompactLineItem[] // items (using 't' since 'i' is for id)
  m?: CompactPaymentMethods  // payment methods - only if person has any
}

interface CompactState {
  p: CompactPerson[]   // people
  c?: string           // currency
  e?: string           // eventName
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

function toCompactPayments(payments?: PaymentMethods): CompactPaymentMethods | undefined {
  if (!payments) return undefined
  const compact: CompactPaymentMethods = {}
  if (payments.venmo) compact.v = payments.venmo
  if (payments.zelle) compact.z = payments.zelle
  if (payments.paypal) compact.p = payments.paypal
  if (payments.cashapp) compact.a = payments.cashapp
  if (payments.other) compact.o = payments.other
  return Object.keys(compact).length > 0 ? compact : undefined
}

function fromCompactPayments(compact?: CompactPaymentMethods): PaymentMethods | undefined {
  if (!compact) return undefined
  const payments: PaymentMethods = {}
  if (compact.v) payments.venmo = compact.v
  if (compact.z) payments.zelle = compact.z
  if (compact.p) payments.paypal = compact.p
  if (compact.a) payments.cashapp = compact.a
  if (compact.o) payments.other = compact.o
  return Object.keys(payments).length > 0 ? payments : undefined
}

function toCompact(state: AppState): CompactState {
  return {
    p: state.people.map(person => {
      const compactPerson: CompactPerson = {
        i: person.id,
        n: person.name,
        t: person.items.map(item => ({
          i: item.id,
          n: item.name,
          a: item.amountCents
        }))
      }
      const compactPayments = toCompactPayments(person.payments)
      if (compactPayments) compactPerson.m = compactPayments
      return compactPerson
    }),
    ...(state.currency && { c: state.currency }),
    ...(state.eventName && { e: state.eventName })
  }
}

function fromCompact(compact: CompactState): AppState {
  return {
    people: compact.p.map(person => {
      const payments = fromCompactPayments(person.m)
      return {
        id: person.i,
        name: person.n,
        items: person.t.map(item => ({
          id: item.i,
          name: item.n,
          amountCents: item.a
        })),
        ...(payments && { payments })
      }
    }),
    ...(compact.c && { currency: compact.c }),
    ...(compact.e && { eventName: compact.e })
  }
}

// URL-safe base64 encoding (no padding, - instead of +, _ instead of /)
// Handles Unicode by encoding to UTF-8 first
function toBase64Url(str: string): string {
  // Convert Unicode string to UTF-8 bytes, then to base64
  const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  )
  return btoa(utf8)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function fromBase64Url(str: string): string {
  // Restore standard base64 characters
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  const padding = base64.length % 4
  if (padding) {
    base64 += '='.repeat(4 - padding)
  }
  // Decode base64 to UTF-8 bytes, then to Unicode string
  const utf8 = atob(base64)
  return decodeURIComponent(
    utf8.split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  )
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
  // Use URL-safe base64 encoding directly on JSON (no encodeURIComponent needed)
  return toBase64Url(json)
}

function decodeState(encoded: string): AppState | null {
  try {
    let json: string

    // Try new URL-safe base64 format first (raw JSON → base64url)
    try {
      json = fromBase64Url(encoded)
      JSON.parse(json) // Validate it's valid JSON
    } catch {
      // Fall back to old format (encodeURIComponent → base64)
      json = decodeURIComponent(atob(encoded))
    }

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

/**
 * Gets the ULID from URL if in ULID mode (?u=ULID)
 */
function getUlidFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('u')
}

function hasUserData(state: AppState): boolean {
  if (state.eventName && state.eventName.trim() !== '') return true
  return state.people.some(person =>
    person.name.trim() !== '' ||
    person.items.some(item => item.name.trim() !== '' || item.amountCents > 0)
  )
}

function updateUrl(state: AppState, isUrlTooLong: boolean): void {
  const url = new URL(window.location.href)

  if (hasUserData(state) && !isUrlTooLong) {
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

// Conservative URL length limit (supports IE/Edge legacy and avoids truncation in messaging apps)
export const URL_LENGTH_LIMIT = 2000

export function useUrlState() {
  // Check for ULID mode first (URL: ?u=ULID)
  const urlUlid = getUlidFromUrl()
  const initialState = urlUlid ? createDefaultState() : (getStateFromUrl() ?? createDefaultState())

  const state = ref<AppState>(initialState)

  // ULID mode state
  const listId = ref<string | null>(urlUlid)
  const listVersion = ref<number>(0)

  const currency = computed(() => state.value.currency || DEFAULT_CURRENCY)
  const eventName = computed(() => state.value.eventName || '')

  // True when state is backed by database instead of URL
  const isUlidMode = computed(() => listId.value !== null)

  // Track if URL is too long (only relevant in URL mode)
  const isUrlTooLong = computed(() => {
    if (isUlidMode.value) return false
    if (!hasUserData(state.value)) return false
    const encoded = encodeState(state.value)
    // Account for base URL + "?data=" prefix
    const estimatedUrlLength = window.location.origin.length + window.location.pathname.length + 6 + encoded.length
    return estimatedUrlLength > URL_LENGTH_LIMIT
  })

  // Only update URL in URL mode (not ULID mode)
  watch([state, isUrlTooLong, isUlidMode], ([newState, tooLong, ulidMode]) => {
    if (!ulidMode) {
      updateUrl(newState, tooLong)
    }
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

  function setEventName(name: string): void {
    state.value.eventName = name.trim() === '' ? undefined : name
  }

  function updatePersonPayments(personId: string, payments: PaymentMethods): void {
    const person = state.value.people.find(p => p.id === personId)
    if (person) {
      const hasAnyPayment = Object.values(payments).some(v => v && v.trim() !== '')
      person.payments = hasAnyPayment ? payments : undefined
    }
  }

  function reset(): void {
    state.value = createDefaultState()
    listId.value = null
    listVersion.value = 0
    // Clear URL to base path
    window.history.replaceState({}, '', window.location.pathname)
  }

  /**
   * Set the entire state (used when loading from API)
   */
  function setState(newState: AppState): void {
    state.value = newState
  }

  /**
   * Enter ULID mode (used after upgrading from URL to database)
   */
  function setUlidMode(id: string, version: number): void {
    listId.value = id
    listVersion.value = version
    // Update URL to ULID format
    const url = new URL(window.location.href)
    url.searchParams.delete('data')
    url.searchParams.set('u', id)
    let urlString = url.toString().replace(/\/\?/, '?')
    window.history.replaceState({}, '', urlString)
  }

  /**
   * Update the version after a successful save
   */
  function setListVersion(version: number): void {
    listVersion.value = version
  }

  return {
    state,
    currency,
    eventName,
    isUrlTooLong,
    isUlidMode,
    listId,
    listVersion,
    addPerson,
    removePerson,
    updatePersonName,
    addLineItem,
    removeLineItem,
    updateLineItem,
    setCurrency,
    setEventName,
    updatePersonPayments,
    reset,
    setState,
    setUlidMode,
    setListVersion
  }
}

// Export internal functions for testing
export const _testing = {
  toCompact,
  fromCompact,
  toBase64Url,
  fromBase64Url,
  encodeState,
  decodeState,
}
