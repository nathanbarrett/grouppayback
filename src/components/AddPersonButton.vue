<script setup lang="ts">
defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    @click="$emit('click')"
    class="w-full py-4 px-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all text-base font-medium"
  >
    + Add Person
  </button>
</template>
