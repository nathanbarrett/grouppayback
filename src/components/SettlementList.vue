<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Settlement, Person } from '../types'
import { formatCents } from '../composables/useSettlements'
import { hasAnyPaymentMethod } from '../composables/usePaymentMethods'
import PaymentPopover from './PaymentPopover.vue'

const props = defineProps<{
  settlements: Settlement[]
  isCalculating: boolean
  currency: string
  people: Person[]
}>()

const popoverPerson = ref<Person | null>(null)
const popoverAmount = ref<number>(0)
const popoverPosition = ref<{ x: number; y: number }>({ x: 0, y: 0 })

const isTouchDevice = computed(() => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
})

// Create a reactive map of person names to their payment status
const payablePersonNames = computed(() => {
  const payable = new Set<string>()
  for (const person of props.people) {
    if (hasAnyPaymentMethod(person.payments)) {
      payable.add(person.name)
    }
  }
  return payable
})

const hasAnyPayablePerson = computed(() => {
  return props.settlements.some(s => payablePersonNames.value.has(s.to))
})

function getPersonByName(name: string): Person | undefined {
  return props.people.find(p => p.name === name)
}

function canPayPerson(name: string): boolean {
  return payablePersonNames.value.has(name)
}

function handleNameClick(event: MouseEvent, settlement: Settlement): void {
  const person = getPersonByName(settlement.to)
  if (!person || !hasAnyPaymentMethod(person.payments)) return

  const target = event.target as HTMLElement
  const rect = target.getBoundingClientRect()

  popoverPerson.value = person
  popoverAmount.value = settlement.amountCents
  popoverPosition.value = {
    x: rect.left + rect.width / 2,
    y: rect.bottom + 8
  }
}

function closePopover(): void {
  popoverPerson.value = null
}
</script>

<template>
  <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 sm:p-6 border border-blue-100">
    <h2 class="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
        <path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z" />
      </svg>
      Who Owes What
    </h2>

    <Transition name="fade" mode="out-in">
      <div v-if="isCalculating" class="text-center py-6">
        <div class="inline-flex items-center gap-2 text-gray-500">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Calculating...
        </div>
      </div>

      <div v-else-if="settlements.length === 0" class="text-center py-6 text-gray-500">
        <p>Add expenses for at least two people to see settlements</p>
      </div>

      <TransitionGroup v-else name="list" tag="ul" class="space-y-3">
        <li
          v-for="settlement in settlements"
          :key="`${settlement.from}-${settlement.to}`"
          class="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex items-center justify-between"
        >
          <div class="flex items-center gap-2 text-sm sm:text-base">
            <span class="font-medium text-gray-800">{{ settlement.from }}</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
            <button
              v-if="canPayPerson(settlement.to)"
              @click="handleNameClick($event, settlement)"
              class="font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2 cursor-pointer transition-colors"
            >
              {{ settlement.to }}
            </button>
            <span v-else class="font-medium text-gray-800">{{ settlement.to }}</span>
          </div>
          <span class="font-bold text-blue-600 text-lg">{{ currency }}{{ formatCents(settlement.amountCents) }}</span>
        </li>
      </TransitionGroup>
    </Transition>

    <p class="mt-4 text-xs text-gray-500 leading-relaxed">
      All expenses are added up and divided equally among everyone.
      Each person's balance is calculated by subtracting their fair share from what they paid.
      Payments are then matched to settle all balances with the fewest transactions.
    </p>

    <p v-if="hasAnyPayablePerson && !isCalculating" class="mt-2 text-xs text-blue-600 font-medium">
      {{ isTouchDevice ? 'Touch' : 'Click' }} on a name to pay them directly.
    </p>

    <PaymentPopover
      v-if="popoverPerson"
      :person="popoverPerson"
      :amount-cents="popoverAmount"
      :currency="currency"
      :position="popoverPosition"
      @close="closePopover"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.4s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.list-move {
  transition: transform 0.4s ease;
}
</style>
