<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Person, PaymentMethods, PaymentProvider } from '../types'
import { PAYMENT_PROVIDERS, validatePaymentMethod } from '../composables/usePaymentMethods'

const props = defineProps<{
  person: Person
  show: boolean
}>()

const emit = defineEmits<{
  save: [payments: PaymentMethods]
  close: []
}>()

const formData = ref<PaymentMethods>({})
const errors = ref<Partial<Record<PaymentProvider, string>>>({})

watch(() => props.show, (showing) => {
  if (showing) {
    formData.value = props.person.payments ? { ...props.person.payments } : {}
    errors.value = {}
  }
}, { immediate: true })

function validateField(provider: PaymentProvider): void {
  const value = formData.value[provider] || ''
  const result = validatePaymentMethod(provider, value)
  if (!result.valid && result.error) {
    errors.value[provider] = result.error
  } else {
    delete errors.value[provider]
  }
}

function validateAll(): boolean {
  errors.value = {}
  let isValid = true
  for (const provider of PAYMENT_PROVIDERS) {
    const value = formData.value[provider.key] || ''
    const result = validatePaymentMethod(provider.key, value)
    if (!result.valid && result.error) {
      errors.value[provider.key] = result.error
      isValid = false
    }
  }
  return isValid
}

function handleSave(): void {
  if (validateAll()) {
    emit('save', { ...formData.value })
  }
}

function handleCancel(): void {
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">Payment Methods</h3>
        <p class="text-sm text-gray-500 mb-4">
          Add payment info for {{ person.name || 'this person' }} so others can pay them directly.
        </p>

        <div class="space-y-4">
          <div v-for="provider in PAYMENT_PROVIDERS" :key="provider.key" class="space-y-1">
            <label :for="`payment-${provider.key}`" class="flex items-center gap-2 text-sm font-medium text-gray-700">
              <svg class="w-5 h-5" :style="{ color: provider.hexColor }" viewBox="0 0 24 24" fill="currentColor">
                <path :d="provider.svgPath" />
              </svg>
              {{ provider.name }}
            </label>
            <input
              :id="`payment-${provider.key}`"
              v-model="formData[provider.key]"
              type="text"
              :placeholder="provider.placeholder"
              @blur="validateField(provider.key)"
              :class="[
                'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors',
                errors[provider.key]
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
              ]"
            />
            <p v-if="errors[provider.key]" class="text-xs text-red-600">{{ errors[provider.key] }}</p>
            <p v-if="provider.key === 'other' && !errors[provider.key]" class="text-xs text-gray-400">URL becomes a link; text is copyable</p>
          </div>
        </div>

        <div class="flex gap-3 justify-end mt-6">
          <button
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            @click="handleSave"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
