export interface LineItem {
  id: string
  name: string
  amountCents: number
}

export type PaymentProvider = 'venmo' | 'zelle' | 'paypal' | 'cashapp' | 'other'

export interface PaymentMethods {
  venmo?: string
  zelle?: string
  paypal?: string
  cashapp?: string
  other?: string
}

export interface Person {
  id: string
  name: string
  items: LineItem[]
  payments?: PaymentMethods
}

export interface Settlement {
  from: string
  to: string
  amountCents: number
}

export interface AppState {
  people: Person[]
  currency?: string
  eventName?: string
}

/**
 * API Response Types
 */

export interface ApiListResponse {
  id: string
  data: AppState
  version: number
  createdAt: number
  updatedAt: number
}

export interface ApiErrorResponse {
  error: string
  code?: string
  expectedVersion?: number
  actualVersion?: number
}

/**
 * Saved list entry stored in localStorage
 */
export interface SavedListEntry {
  id: string // ULID
  name: string // Event name or "Untitled"
  createdAt: number
  lastAccessedAt: number
}
