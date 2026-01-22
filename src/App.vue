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
  isUrlTooLong,
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
const showCopyHintModal = ref(false)

const COPY_HINT_SEEN_KEY = 'grouppayback_copy_hint_seen'

function isMobile(): boolean {
  return window.innerWidth < 640
}

async function copyLink() {
  await navigator.clipboard.writeText(window.location.href)
  copied.value = true

  // Show hint modal on mobile if they haven't seen it
  const shouldShowModal = isMobile() && !localStorage.getItem(COPY_HINT_SEEN_KEY)

  if (shouldShowModal) {
    // Delay to ensure button visually turns green before modal appears
    setTimeout(() => {
      showCopyHintModal.value = true
    }, 400)
    // Don't reset copied state - it will be reset when modal is dismissed
  } else {
    // Normal flow: reset after 2 seconds
    setTimeout(() => {
      copied.value = false
    }, 2000)
  }
}

function dismissCopyHint() {
  showCopyHintModal.value = false
  localStorage.setItem(COPY_HINT_SEEN_KEY, 'true')
  // Reset copied state after dismissing modal
  setTimeout(() => {
    copied.value = false
  }, 500)
}

function confirmReset() {
  reset()
  showResetModal.value = false
}
</script>

<template>
  <div class="min-h-dvh bg-gray-50">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-4xl mx-auto px-4 py-4 sm:py-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">GroupPayback</h1>
            <p class="mt-1 text-sm text-gray-500">Split bills simply</p>
          </div>
          <div class="flex flex-col items-end gap-1">
            <button
              @click="copyLink"
              :class="[
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all shrink-0',
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
            <p class="hidden sm:block text-xs text-gray-500 text-right">All data is in the URL.<br>Reshare after any updates.</p>
          </div>
        </div>
      </div>
    </header>

    <!-- URL Length Warning -->
    <Transition name="slide-fade">
      <div v-if="isUrlTooLong" class="bg-amber-50 border-b border-amber-200">
        <div class="max-w-4xl mx-auto px-4 py-3">
          <div class="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            <p class="text-sm text-amber-800">
              <span class="font-medium">Too many entries.</span>
              The URL is getting too long to share reliably. Consider combining similar items or grouping people to keep the link shareable.
            </p>
          </div>
        </div>
      </div>
    </Transition>

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

    <footer class="py-6 flex justify-center items-center gap-4">
      <a
        href="https://github.com/nathanbarrett/grouppayback"
        target="_blank"
        rel="noopener noreferrer"
        class="text-gray-400 hover:text-gray-600 transition-colors"
        title="View on GitHub"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
      </a>
      <a
        href="https://buymeacoffee.com/nathanbarrett"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-amber-600 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21V19H4V13.5C4 12.3507 4.31 11.2764 4.92654 10.2698C5.54428 9.26201 6.39666 8.52332 7.48 8.05L7.92 10.05C7.15 10.35 6.52 10.82 6.04 11.47C5.56 12.12 5.32 12.84 5.32 13.62V19H10.68V13.62C10.68 12.84 10.44 12.12 9.96 11.47C9.48 10.82 8.85 10.35 8.08 10.05L8.52 8.05C9.60334 8.52332 10.4557 9.26201 11.0735 10.2698C11.69 11.2764 12 12.3507 12 13.5V19H14V13.5C14 12.3507 14.31 11.2764 14.9265 10.2698C15.5443 9.26201 16.3967 8.52332 17.48 8.05L17.92 10.05C17.15 10.35 16.52 10.82 16.04 11.47C15.56 12.12 15.32 12.84 15.32 13.62V19H20V21H2ZM18 9C17.45 9 16.9793 8.80433 16.588 8.413C16.196 8.021 16 7.55 16 7V3H18V7H20V3H22V7C22 7.55 21.8043 8.021 21.413 8.413C21.0207 8.80433 20.55 9 20 9H18Z"/>
        </svg>
        Buy me a coffee
      </a>
    </footer>

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

    <!-- Copy Link Hint Modal (mobile only, shown once) -->
    <Transition name="modal">
      <div
        v-if="showCopyHintModal"
        class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        @click.self="dismissCopyHint"
      >
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
          <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Link Copied!</h3>
          <p class="text-gray-600 text-sm mb-6">
            All data is stored in the URL.<br>
            If you make changes, you'll need to copy and share the link again.
          </p>
          <button
            @click="dismissCopyHint"
            class="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Got it
          </button>
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
