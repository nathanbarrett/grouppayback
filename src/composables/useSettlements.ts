import { computed, ref, watch, type Ref } from 'vue'
import type { AppState, Settlement } from '../types'
import type { Person } from '../types'

interface PersonBalance {
  name: string
  balanceCents: number
}

function calculateTotalCents(person: Person): number {
  return person.items.reduce((sum, item) => sum + item.amountCents, 0)
}

function calculateSettlements(people: Person[]): Settlement[] {
  const validPeople = people.filter(p => p.name.trim() !== '')

  if (validPeople.length < 2) {
    return []
  }

  const totalCents = validPeople.reduce((sum, p) => sum + calculateTotalCents(p), 0)
  const fairShareCents = Math.floor(totalCents / validPeople.length)

  const balances: PersonBalance[] = validPeople.map(person => ({
    name: person.name,
    balanceCents: calculateTotalCents(person) - fairShareCents
  }))

  const debtors = balances
    .filter(b => b.balanceCents < 0)
    .map(b => ({ ...b, balanceCents: Math.abs(b.balanceCents) }))
    .sort((a, b) => b.balanceCents - a.balanceCents)

  const creditors = balances
    .filter(b => b.balanceCents > 0)
    .sort((a, b) => b.balanceCents - a.balanceCents)

  const settlements: Settlement[] = []

  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!
    const creditor = creditors[creditorIndex]!

    const amount = Math.min(debtor.balanceCents, creditor.balanceCents)

    if (amount > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amountCents: amount
      })
    }

    debtor.balanceCents -= amount
    creditor.balanceCents -= amount

    if (debtor.balanceCents === 0) debtorIndex++
    if (creditor.balanceCents === 0) creditorIndex++
  }

  return settlements
}

export function useSettlements(state: Ref<AppState>, debounceMs: number = 2000) {
  const settlements = ref<Settlement[]>([])
  const isCalculating = ref(false)

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const hasEnoughData = computed(() => {
    const peopleWithItems = state.value.people.filter(
      p => p.name.trim() !== '' && p.items.length > 0
    )
    return peopleWithItems.length >= 2
  })

  watch(
    () => state.value.people,
    () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      isCalculating.value = true

      timeoutId = setTimeout(() => {
        settlements.value = calculateSettlements(state.value.people)
        isCalculating.value = false
      }, debounceMs)
    },
    { deep: true, immediate: true }
  )

  return {
    settlements,
    isCalculating,
    hasEnoughData
  }
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}
