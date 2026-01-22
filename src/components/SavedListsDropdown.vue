<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { SavedListEntry } from '../types'

const props = defineProps<{
  lists: SavedListEntry[]
  currentListId?: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
}>()

const isOpen = ref(false)
const dropdownRef = ref<HTMLElement | null>(null)

// Close dropdown when clicking outside
function handleClickOutside(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - timestamp

  // Less than 1 hour ago
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000))
    return minutes <= 1 ? 'Just now' : `${minutes}m ago`
  }

  // Less than 24 hours ago
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000))
    return `${hours}h ago`
  }

  // Less than 7 days ago
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000))
    return days === 1 ? 'Yesterday' : `${days}d ago`
  }

  // Otherwise show date
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleSelect(id: string) {
  emit('select', id)
  isOpen.value = false
}

function handleRemove(e: Event, id: string) {
  e.stopPropagation()
  emit('remove', id)
}

const hasLists = computed(() => props.lists.length > 0)
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      @click="isOpen = !isOpen"
      :disabled="!hasLists"
      class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <span>My Lists</span>
      <svg
        class="w-4 h-4 transition-transform"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown menu -->
    <Transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <div
        v-if="isOpen && hasLists"
        class="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
      >
        <div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
          Recent Lists
        </div>
        <div class="max-h-64 overflow-y-auto">
          <div
            v-for="list in lists"
            :key="list.id"
            @click="handleSelect(list.id)"
            role="button"
            tabindex="0"
            @keydown.enter="handleSelect(list.id)"
            @keydown.space.prevent="handleSelect(list.id)"
            class="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between group cursor-pointer"
            :class="{ 'bg-blue-50': currentListId === list.id }"
          >
            <div class="min-w-0 flex-1">
              <div class="font-medium text-gray-900 truncate">
                {{ list.name }}
              </div>
              <div class="text-xs text-gray-500">
                {{ formatDate(list.lastAccessedAt) }}
              </div>
            </div>
            <button
              @click="handleRemove($event, list.id)"
              class="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove from list"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
