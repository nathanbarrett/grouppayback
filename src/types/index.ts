export interface LineItem {
  id: string
  name: string
  amountCents: number
}

export interface Person {
  id: string
  name: string
  items: LineItem[]
}

export interface Settlement {
  from: string
  to: string
  amountCents: number
}

export interface AppState {
  people: Person[]
  currency?: string
}
