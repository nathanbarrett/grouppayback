<script setup lang="ts">
import { ref } from 'vue'
import { useUrlState, CURRENCIES } from './composables/useUrlState'
import { useSettlements } from './composables/useSettlements'
import PersonCard from './components/PersonCard.vue'
import AddPersonButton from './components/AddPersonButton.vue'
import SettlementList from './components/SettlementList.vue'

const {
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
} = useUrlState()

const { settlements, isCalculating, hasEnoughData } = useSettlements(state)

const copied = ref(false)
const showResetModal = ref(false)

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function confirmReset() {
  reset()
  showResetModal.value = false
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">GroupPayback</h1>
            <p class="mt-1 text-sm text-gray-500">Split bills simply</p>
          </div>
          <div class="flex flex-col items-end gap-1.5">
            <button
              @click="copyLink"
              :class="[
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all',
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
              ]"
            >
              <svg v-if="!copied" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              {{ copied ? 'Copied!' : 'Copy Link' }}
            </button>
            <p class="text-xs text-gray-500 text-right">All data is in the URL.<br>Reshare after any updates.</p>
          </div>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <div class="grid gap-6 lg:grid-cols-2">
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-gray-800">Expenses</h2>
            <div class="flex items-center gap-2">
              <select
                :value="currency"
                @change="setCurrency(($event.target as HTMLSelectElement).value)"
                class="px-2 py-1 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option v-for="c in CURRENCIES" :key="c.symbol" :value="c.symbol">
                  {{ c.symbol }} {{ c.name }}
                </option>
              </select>
              <button
                @click="showResetModal = true"
                class="px-2 py-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
                title="Start over"
              >
                Start Over
              </button>
            </div>
          </div>
          <div class="space-y-4">
            <PersonCard
              v-for="person in state.people"
              :key="person.id"
              :person="person"
              :currency="currency"
              :can-remove="state.people.length > 1"
              @update-name="name => updatePersonName(person.id, name)"
              @add-item="addLineItem(person.id)"
              @remove-item="itemId => removeLineItem(person.id, itemId)"
              @update-item="(itemId, updates) => updateLineItem(person.id, itemId, updates)"
              @remove="removePerson(person.id)"
            />
            <AddPersonButton @click="addPerson" />
          </div>
        </section>

        <section>
          <Transition name="slide-fade">
            <SettlementList
              v-if="hasEnoughData"
              :settlements="settlements"
              :is-calculating="isCalculating"
              :currency="currency"
            />
          </Transition>
        </section>
      </div>
    </main>

    <!-- Reset Confirmation Modal -->
    <Transition name="modal">
      <div
        v-if="showResetModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        @click.self="showResetModal = false"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Start Over?</h3>
          <p class="text-gray-600 text-sm mb-6">
            This will clear all people and expenses. This action cannot be undone.
          </p>
          <div class="flex gap-3 justify-end">
            <button
              @click="showResetModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="confirmReset"
              class="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Yes, Start Over
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateY(20px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(-20px);
  opacity: 0;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
