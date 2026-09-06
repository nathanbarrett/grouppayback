<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    @click="emit('click')"
    :class="[
      'inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors',
      variant === 'secondary'
        ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        : 'bg-blue-600 hover:bg-blue-700 text-white',
      size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'
    ]"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M7 18a5 5 0 01-1-9.9A7 7 0 0119 8a5 5 0 010 10H7z" />
    </svg>
    <span>Save event</span>
  </button>
</template>
