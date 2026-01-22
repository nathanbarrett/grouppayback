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
        : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white',
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
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
    <span>Upgrade</span>
  </button>
</template>
