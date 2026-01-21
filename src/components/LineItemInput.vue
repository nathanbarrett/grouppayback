<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { LineItem } from '../types'

const props = defineProps<{
  item: LineItem
  currency: string
}>()

const emit = defineEmits<{
  update: [updates: { name?: string; amountCents?: number }]
  remove: []
}>()

const localAmount = ref('')
let debounceTimeout: ReturnType<typeof setTimeout> | null = null

function formatCentsToDisplay(cents: number): string {
  if (cents === 0) return ''
  return (cents / 100).toFixed(2)
}

function parseDisplayToCents(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '')
  const dollars = parseFloat(cleaned) || 0
  return Math.round(dollars * 100)
}

// Sync from prop to local when prop changes externally
watch(() => props.item.amountCents, (newCents) => {
  const formatted = formatCentsToDisplay(newCents)
  // Only update local if it differs significantly (to avoid overwriting while typing)
  if (parseDisplayToCents(localAmount.value) !== newCents) {
    localAmount.value = formatted
  }
}, { immediate: true })

function emitAmountUpdate() {
  const cents = parseDisplayToCents(localAmount.value)
  emit('update', { amountCents: cents })
}

function debouncedEmitAmount() {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }
  debounceTimeout = setTimeout(() => {
    emitAmountUpdate()
  }, 300)
}

function onAmountInput(event: Event) {
  const input = event.target as HTMLInputElement
  let value = input.value

  // Remove all non-digit and non-decimal characters
  value = value.replace(/[^\d.]/g, '')

  // Only allow one decimal point
  const parts = value.split('.')
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('')
  }

  // Limit to 2 decimal places
  if (parts.length === 2 && parts[1]!.length > 2) {
    value = parts[0]! + '.' + parts[1]!.slice(0, 2)
  }

  // Update local state and input value
  localAmount.value = value
  input.value = value

  // Emit debounced update
  debouncedEmitAmount()
}

function onAmountBlur() {
  // Clear any pending debounce and emit immediately
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
    debounceTimeout = null
  }
  emitAmountUpdate()
  // Format the display after blur
  localAmount.value = formatCentsToDisplay(parseDisplayToCents(localAmount.value))
}

onUnmounted(() => {
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
  }
})

function updateName(name: string) {
  emit('update', { name })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <input
      type="text"
      :value="item.name"
      @input="updateName(($event.target as HTMLInputElement).value)"
      placeholder="Item name"
      class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
    />
    <div class="relative">
      <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{{ currency }}</span>
      <input
        type="text"
        inputmode="decimal"
        :value="localAmount"
        @input="onAmountInput"
        @blur="onAmountBlur"
        placeholder="0.00"
        class="w-24 pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-right"
      />
    </div>
    <button
      @click="$emit('remove')"
      class="p-2 text-gray-400 hover:text-red-500 transition-colors"
      title="Remove item"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  </div>
</template>
