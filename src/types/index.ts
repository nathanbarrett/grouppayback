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
