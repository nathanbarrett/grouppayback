<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
const props = defineProps<{
  show: boolean
  eventName: string
  busy: boolean
  locked: boolean
  error: string
  savedId: string | null
  emailStatus: string | null
  retryAt: number
  attempts: number
}>()
const emit = defineEmits<{ close: []; save: [email: string, title: string] }>()
const title = ref('')
const email = ref('')
const dialog = ref<HTMLElement | null>(null)
const now = ref(Date.now())
const copied = ref(false)
const copyError = ref('')
let previousFocus: HTMLElement | null = null
const timer = setInterval(() => { now.value = Date.now() }, 250)
onUnmounted(() => { clearInterval(timer); previousFocus?.focus() })
watch(() => props.show, async show => {
  if (show) {
    if (!props.locked) { title.value = props.eventName; email.value = '' }
    previousFocus = document.activeElement as HTMLElement
    await nextTick()
    dialog.value?.querySelector<HTMLInputElement>('input')?.focus()
  } else { previousFocus?.focus() }
}, { immediate: true })
const remaining = computed(() => Math.max(0, Math.ceil((props.retryAt - now.value) / 1000)))
const countdown = computed(() => `${Math.floor(remaining.value / 60)}:${String(remaining.value % 60).padStart(2, '0')}`)
const link = computed(() => props.savedId ? `${window.location.origin}${window.location.pathname}?u=${props.savedId}` : '')
const valid = computed(() => !!title.value.trim() && !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(title.value) && /^[^\s@<>"(),;:]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
function submit() { if (valid.value && !props.busy && !remaining.value) emit('save', email.value.trim(), title.value.trim()) }
function close() { if (!props.busy) emit('close') }
async function copy() {
  try { await navigator.clipboard.writeText(link.value); copied.value = true; copyError.value = '' }
  catch { copyError.value = 'Copy failed. Select and copy the link above.' }
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); close() }
  if (event.key !== 'Tab') return
  const controls = Array.from(dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href]') || [])
  const first = controls[0], last = controls[controls.length - 1]
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" @click.self="close" @keydown="keydown">
      <section ref="dialog" role="dialog" aria-modal="true" aria-labelledby="save-title" aria-describedby="save-description" :aria-busy="busy" class="save-modal bg-white rounded-2xl shadow-2xl w-full max-w-[480px] max-h-[90dvh] overflow-y-auto">
        <div class="relative px-6 pt-6 sm:px-8 sm:pt-8">
          <button type="button" aria-label="Close" :disabled="busy" class="absolute top-3 right-3 text-gray-500" @click="close">×</button>
          <h2 id="save-title" class="text-2xl font-bold text-gray-900">{{ savedId ? 'Your event is saved.' : 'Save your event' }}</h2>
          <p id="save-description" class="mt-2 text-sm text-gray-600">{{ savedId ? 'Keep one shared link for your group.' : 'Keep one shared link for your group. We’ll email you a copy so it’s easy to find later.' }}</p>
        </div>
        <form v-if="!savedId" @submit.prevent="submit">
          <div class="px-6 py-6 sm:px-8">
            <label for="save-event-title" class="flex justify-between text-sm font-semibold">Event title <span class="text-xs font-normal text-gray-500">Required</span></label>
            <input id="save-event-title" v-model="title" name="title" required maxlength="100" :disabled="busy || locked" aria-describedby="title-hint" class="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2.5" />
            <p id="title-hint" class="mt-2 mb-5 text-xs text-gray-500">Filled in from your event. You can change it here.</p>
            <label for="save-event-email" class="flex justify-between text-sm font-semibold">Your email <span class="text-xs font-normal text-gray-500">Required</span></label>
            <input id="save-event-email" v-model="email" name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@example.com" :disabled="busy || locked" aria-describedby="email-hint" class="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2.5" />
            <p id="email-hint" class="mt-2 text-xs text-gray-500">We’ll send your event link to this address.</p>
            <div class="mt-5 rounded-lg bg-gray-50 border border-gray-200 p-4 text-xs text-gray-600"><strong class="block text-gray-800 mb-1">Just a record of your link.</strong>One email. No newsletters, no account, nothing to verify.</div>
            <p class="mt-4 text-xs text-gray-500">Anyone with the link can view and edit this event.<br>Share it only with people you trust.</p>
            <p v-if="locked && !busy" class="mt-3 text-xs text-gray-500">Details are kept unchanged so retries won’t create another event.</p>
            <p v-if="busy" role="status" class="mt-4 text-sm text-gray-600">Saving your event and sending your link…</p>
            <p v-if="error" role="alert" class="mt-4 text-sm text-red-700">{{ error }}</p>
          </div>
          <div class="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 sm:px-8">
            <button type="button" :disabled="busy" @click="close">Cancel</button>
            <button class="primary" :disabled="busy || !!remaining || !valid" type="submit">{{ busy ? 'Saving…' : remaining ? `Retry in ${countdown}` : locked ? 'Retry' : 'Save & email link' }}</button>
          </div>
        </form>
        <div v-else class="px-6 py-6 sm:px-8" aria-live="polite">
          <p v-if="emailStatus === 'sent'" class="text-sm text-gray-600">We sent the link to {{ email }}. Keep a copy here, too.</p>
          <p v-else class="text-sm text-gray-600"><strong>Keep your link.</strong> {{ emailStatus === 'failed' || emailStatus === 'mocked' ? 'Your email was not sent.' : 'We couldn’t confirm that your email was sent.' }} Copy the link now so you don’t lose it.</p>
          <p class="my-4 p-3 bg-gray-50 border border-gray-200 rounded-lg break-all select-all text-sm">{{ link }}</p>
          <p class="text-xs text-gray-500">Anyone with this link can view and edit the event.</p>
          <p v-if="error || copyError" role="alert" class="mt-3 text-sm text-red-700">{{ error || copyError }}</p>
          <div class="mt-5 flex flex-wrap gap-2">
            <button :class="emailStatus !== 'sent' ? 'primary' : ''" @click="copy">{{ copied ? 'Copied!' : 'Copy link' }}</button>
            <button v-if="emailStatus === 'failed' && attempts < 3" :disabled="busy || !!remaining" @click="submit">{{ busy ? 'Trying…' : remaining ? `Retry in ${countdown}` : 'Try email again' }}</button>
            <button :disabled="busy" @click="close">Done</button>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>
<style scoped>
.save-modal button { min-height: 44px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 16px; font-size: 14px; font-weight: 600; background: white; color: #374151; }
.save-modal button.primary { background: #2563eb; border-color: #2563eb; color: white; }
.save-modal button:disabled { opacity: .5; cursor: not-allowed; }
.save-modal button:focus-visible, .save-modal input:focus-visible { outline: 3px solid #93c5fd; outline-offset: 3px; }
</style>
