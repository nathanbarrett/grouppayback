<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Person, PaymentProvider } from '../types'
import { PAYMENT_PROVIDERS, getPaymentUrl, hasAnyPaymentMethod } from '../composables/usePaymentMethods'
import { formatCents } from '../composables/useSettlements'

const props = defineProps<{
  person: Person
  amountCents: number
  currency: string
  position: { x: number; y: number }
}>()

const emit = defineEmits<{
  close: []
}>()

const popoverRef = ref<HTMLElement | null>(null)
const copiedProvider = ref<PaymentProvider | null>(null)

const availableMethods = computed(() => {
  if (!props.person.payments) return []
  return PAYMENT_PROVIDERS.filter(p => {
    const value = props.person.payments?.[p.key]
    return value && value.trim() !== ''
  })
})

async function copyToClipboard(value: string, provider: PaymentProvider): Promise<void> {
  await navigator.clipboard.writeText(value)
  copiedProvider.value = provider
  setTimeout(() => {
    copiedProvider.value = null
  }, 2000)
}

function handleClickOutside(event: MouseEvent): void {
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

function handleScroll(): void {
  emit('close')
}

onMounted(() => {
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
  }, 0)
  window.addEventListener('scroll', handleScroll, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', handleScroll, true)
})
</script>

<template>
  <Transition name="popover">
    <div
      v-if="hasAnyPaymentMethod(person.payments)"
      ref="popoverRef"
      class="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 min-w-[200px] max-w-[280px]"
      :style="{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)'
      }"
    >
      <div class="text-center mb-3">
        <p class="text-sm text-gray-600">Pay <span class="font-semibold">{{ person.name }}</span></p>
        <p class="text-lg font-bold text-gray-900">{{ currency }}{{ formatCents(amountCents) }}</p>
      </div>

      <div class="space-y-2">
        <template v-for="method in availableMethods" :key="method.key">
          <!-- Link button for providers with URLs (including "other" when it's a URL) -->
          <a
            v-if="getPaymentUrl(method.key, person.payments?.[method.key] || '')"
            :href="getPaymentUrl(method.key, person.payments?.[method.key] || '') ?? undefined"
            target="_blank"
            rel="noopener noreferrer"
            :class="[
              'flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors',
              method.color,
              method.hoverColor
            ]"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path :d="method.svgPath" />
            </svg>
            Pay with {{ method.name }}
          </a>

          <!-- Copy button for Zelle and Other (when not a URL) -->
          <button
            v-else
            @click="copyToClipboard(person.payments?.[method.key] || '', method.key)"
            :class="[
              'flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg text-white text-sm font-medium transition-colors',
              method.color,
              method.hoverColor
            ]"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path :d="method.svgPath" />
            </svg>
            <template v-if="copiedProvider === method.key">
              Copied!
            </template>
            <template v-else>
              {{ method.key === 'zelle' ? 'Copy Zelle info' : 'Copy info' }}
            </template>
          </button>

          <!-- Show the actual value below for copy buttons (Zelle or Other when not a URL) -->
          <p
            v-if="!getPaymentUrl(method.key, person.payments?.[method.key] || '') && person.payments?.[method.key]"
            class="text-xs text-gray-500 text-center -mt-1"
          >
            {{ person.payments[method.key] }}
          </p>
        </template>
      </div>

      <!-- Arrow pointing up -->
      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45"></div>
    </div>
  </Transition>
</template>

<style scoped>
.popover-enter-active,
.popover-leave-active {
  transition: all 0.15s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
