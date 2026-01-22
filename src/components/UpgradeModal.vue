<script setup lang="ts">
defineProps<{
  show: boolean
  isLoading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  close: []
  upgrade: []
}>()

const features = [
  {
    icon: '👥',
    title: 'Unlimited People',
    description: 'Add as many people as you need',
  },
  {
    icon: '📝',
    title: 'Unlimited Items',
    description: 'No limits on line items per person',
  },
  {
    icon: '🔗',
    title: 'Shareable Link',
    description: 'Short, easy-to-share URLs',
  },
  {
    icon: '💾',
    title: 'Auto-Save',
    description: 'Changes saved automatically',
  },
]

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click="handleBackdropClick"
      >
        <div
          class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          @click.stop
        >
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-8 text-white text-center">
            <div class="text-4xl mb-2">⚡</div>
            <h2 class="text-2xl font-bold">Upgrade Your List</h2>
            <p class="text-blue-100 mt-1">Your list is too large for URL sharing</p>
          </div>

          <!-- Features -->
          <div class="px-6 py-6">
            <div class="space-y-4">
              <div
                v-for="feature in features"
                :key="feature.title"
                class="flex items-start gap-3"
              >
                <span class="text-2xl">{{ feature.icon }}</span>
                <div>
                  <h3 class="font-semibold text-gray-900">{{ feature.title }}</h3>
                  <p class="text-sm text-gray-500">{{ feature.description }}</p>
                </div>
              </div>
            </div>

            <!-- Error message -->
            <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {{ error }}
            </div>

            <!-- Price badge -->
            <div class="mt-6 text-center">
              <span class="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                Free during beta
              </span>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-6 pb-6 flex gap-3">
            <button
              @click="emit('close')"
              class="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              :disabled="isLoading"
            >
              Cancel
            </button>
            <button
              @click="emit('upgrade')"
              :disabled="isLoading"
              class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg
                v-if="isLoading"
                class="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {{ isLoading ? 'Upgrading...' : 'Upgrade Now' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: all 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
}
</style>
