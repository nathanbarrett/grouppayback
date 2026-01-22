<script setup lang="ts">
defineProps<{
  disabled?: boolean
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    @click="$emit('click')"
    :disabled="disabled"
    :class="[
      'w-full py-4 px-6 border-2 border-dashed rounded-xl text-base font-medium transition-all',
      disabled
        ? 'border-gray-200 text-gray-300 cursor-not-allowed bg-gray-50'
        : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'
    ]"
  >
    + Add Person
  </button>
</template>
