import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
it('matches cloud string limits on editable name and payment inputs', () => {
 for (const [file, binding, max] of [
  ['src/App.vue', ':value="eventName"', 100],
  ['src/components/PersonCard.vue', ':value="person.name"', 200],
  ['src/components/LineItemInput.vue', ':value="item.name"', 200],
  ['src/components/PaymentMethodsModal.vue', 'v-model="formData[provider.key]"', 200],
 ] as const) {
  const inputs = readFileSync(file, 'utf8').match(/<input\b[^>]*>/g) ?? []
  expect(inputs.find(input => input.includes(binding))).toContain(`maxlength="${max}"`)
 }
})
