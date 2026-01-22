<script setup lang="ts">
import { computed } from 'vue'
import type { Person } from '../types'
import LineItemInput from './LineItemInput.vue'
import { formatCents } from '../composables/useSettlements'

const props = defineProps<{
  person: Person
  currency: string
  canRemove: boolean
  disableAddItem?: boolean
}>()

const emit = defineEmits<{
  updateName: [name: string]
  addItem: []
  removeItem: [itemId: string]
  updateItem: [itemId: string, updates: { name?: string; amountCents?: number }]
  remove: []
}>()

const totalCents = computed(() => {
  return props.person.items.reduce((sum, item) => sum + item.amountCents, 0)
})
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
    <div class="flex items-center justify-between mb-4">
      <input
        type="text"
        :value="person.name"
        @input="$emit('updateName', ($event.target as HTMLInputElement).value)"
        placeholder="Person's name"
        class="text-lg font-semibold bg-transparent border-b-2 border-transparent focus:border-blue-500 focus:outline-none px-1 py-1 w-full max-w-[200px]"
      />
      <div class="flex items-center gap-2">
        <span v-if="totalCents > 0" class="text-sm font-medium text-gray-600">
          Total: {{ currency }}{{ formatCents(totalCents) }}
        </span>
        <button
          v-if="canRemove"
          @click="$emit('remove')"
          class="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
          title="Remove person"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <LineItemInput
        v-for="item in person.items"
        :key="item.id"
        :item="item"
        :currency="currency"
        @update="updates => $emit('updateItem', item.id, updates)"
        @remove="$emit('removeItem', item.id)"
      />
    </div>

    <button
      @click="$emit('addItem')"
      :disabled="disableAddItem"
      :class="[
        'mt-4 w-full py-2 px-4 border-2 border-dashed rounded-lg text-sm font-medium transition-colors',
        disableAddItem
          ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
          : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500'
      ]"
    >
      + Add Item
    </button>
  </div>
</template>
