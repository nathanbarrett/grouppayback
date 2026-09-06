import { ref, type Ref } from 'vue'
import type { AppState, ApiCreateListRequest, ApiCreateListResponse } from '../types'

interface Options {
  state: Ref<AppState>
  listId: Ref<string | null>
  createList: (request: ApiCreateListRequest) => Promise<ApiCreateListResponse>
  setUlidMode: (id: string, version: number) => void
  setEventName: (name: string) => void
  addSavedList: (id: string, title: string) => void
  startAutoSave: () => { saveNow: () => unknown }
}

export function useSaveEvent(options: Options) {
  const visible = ref(false)
  const busy = ref(false)
  const error = ref('')
  const savedId = ref<string | null>(null)
  const emailStatus = ref<ApiCreateListResponse['email']['status'] | null>(null)
  const retryAt = ref(0)
  const locked = ref(false)
  const attempts = ref(0)
  let key = ''
  let request: ApiCreateListRequest | null = null
  let originalState = ''
  let sequence = 0

  function open() {
    if (!key) key = crypto.randomUUID()
    visible.value = true
  }
  function reset() {
    sequence++
    visible.value = false
    busy.value = false
    savedId.value = null
    emailStatus.value = null
    error.value = ''
    retryAt.value = 0
    locked.value = false
    attempts.value = 0
    key = ''
    request = null
  }
  function close() {
    if (busy.value) return
    visible.value = false
    // Retain uncertain requests across close/reopen to avoid duplicate events.
    if (savedId.value) reset()
  }
  async function submit(email: string, title: string) {
    if (busy.value || Date.now() < retryAt.value || emailStatus.value === 'sent' || emailStatus.value === 'pending' || attempts.value >= 3) return
    if (!request) {
      originalState = JSON.stringify(options.state.value)
      request = { idempotencyKey: key || crypto.randomUUID(), email: email.trim(), title: title.trim(), data: JSON.parse(originalState) }
      request.data.eventName = request.title
    }
    locked.value = true
    busy.value = true
    error.value = ''
    const current = ++sequence
    try {
      const result = await options.createList(request)
      if (current !== sequence) return
      if (options.listId.value && options.listId.value !== savedId.value) { reset(); return }
      if (!savedId.value) {
        options.setUlidMode(result.id, result.version)
        // Preserve edits made while the POST was in flight, including title edits.
        const original = JSON.parse(originalState) as AppState
        if (options.state.value.eventName === original.eventName) options.setEventName(request.title)
        savedId.value = result.id
        const saver = options.startAutoSave()
        try { options.addSavedList(result.id, options.state.value.eventName || request.title) } catch { /* storage cannot undo persistence */ }
        if (JSON.stringify(options.state.value) !== JSON.stringify(request.data)) saver.saveNow()
      }
      attempts.value++
      emailStatus.value = result.email.status
    } catch (cause) {
      if (current !== sequence) return
      const failure = cause as { status?: number; retryAfterSeconds?: number }
      if (failure.status === 429) {
        retryAt.value = Date.now() + Math.max(1, failure.retryAfterSeconds || 300) * 1000
        error.value = 'A few too many requests. Please wait before trying again.'
      } else if (failure.status === 400 || failure.status === 413) {
        error.value = cause instanceof Error ? cause.message : 'Please check your event details.'
        request = null
        locked.value = false
      } else {
        error.value = savedId.value ? 'Your event is saved. We couldn’t confirm the email. Keep your link or retry.' : 'We couldn’t confirm the save. Retry safely with the same details.'
      }
    } finally {
      if (current === sequence) busy.value = false
    }
  }
  return { visible, busy, error, savedId, emailStatus, retryAt, locked, attempts, open, close, reset, submit }
}
