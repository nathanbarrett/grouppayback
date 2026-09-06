import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useSaveEvent } from './useSaveEvent'
import type { AppState, ApiCreateListResponse } from '../types'

function pendingFlow() {
  let resolve!: (value: ApiCreateListResponse) => void
  let reject!: (reason: unknown) => void
  const createList = vi.fn(() => new Promise<ApiCreateListResponse>((yes, no) => { resolve = yes; reject = no }))
  const listId = ref<string | null>(null)
  const setUlidMode = vi.fn()
  const addSavedList = vi.fn()
  const startAutoSave = vi.fn(() => ({ saveNow: vi.fn() }))
  const flow = useSaveEvent({ state: ref<AppState>({ people: [] }), listId, createList, setUlidMode, setEventName: vi.fn(), addSavedList, startAutoSave })
  const result: ApiCreateListResponse = { id: 'old', version: 1, data: { people: [] }, createdAt: 0, updatedAt: 0, email: { status: 'sent' } }
  return { flow, listId, setUlidMode, addSavedList, startAutoSave, resolve: () => resolve(result), reject: () => reject(new Error('offline')) }
}

it.each(['resolve', 'reject'] as const)('ignores stale %s after reset', async outcome => {
  const context = pendingFlow()
  context.flow.open()
  const first = context.flow.submit('a@example.com', 'Old')
  const finishOld = context[outcome]
  // Capture the first resolver before a newer submit replaces it.
  context.flow.reset()
  finishOld()
  await first
  expect(context.flow.savedId.value).toBeNull()
  expect(context.flow.error.value).toBe('')
  expect(context.setUlidMode).not.toHaveBeenCalled()
  expect(context.addSavedList).not.toHaveBeenCalled()
  expect(context.startAutoSave).not.toHaveBeenCalled()
})

it('discards an in-flight success after another event becomes active', async () => {
  const context = pendingFlow()
  context.flow.open()
  const pending = context.flow.submit('a@example.com', 'Old')
  context.listId.value = 'different-event'
  context.resolve()
  await pending
  expect(context.flow.visible.value).toBe(false)
  expect(context.flow.busy.value).toBe(false)
  expect(context.setUlidMode).not.toHaveBeenCalled()
  expect(context.addSavedList).not.toHaveBeenCalled()
  expect(context.startAutoSave).not.toHaveBeenCalled()
})

describe('save event', () => {
  it('replays an immutable request and persists before storage even when email fails', async () => {
    const state = ref<AppState>({ people: [], eventName: 'Trip' })
    const listId = ref<string | null>(null)
    const order: string[] = []
    const createList = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ id: 'saved', version: 1, data: { people: [] }, email: { status: 'failed' } })
    const saveNow = vi.fn()
    const flow = useSaveEvent({ state, listId, createList, setEventName: name => { state.value.eventName = name }, setUlidMode: id => { order.push('mode'); listId.value = id }, addSavedList: () => { order.push('storage'); throw new Error('quota') }, startAutoSave: () => ({ saveNow }) })
    flow.open()
    await flow.submit('a@example.com', 'Trip')
    state.value.currency = '€'
    await flow.submit('a@example.com', 'Trip')
    expect(createList.mock.calls[0]![0]).toEqual(createList.mock.calls[1]![0])
    expect(createList.mock.calls[1]![0].data.currency).toBeUndefined()
    expect(order).toEqual(['mode', 'storage'])
    expect(flow.emailStatus.value).toBe('failed')
    expect(flow.savedId.value).toBe('saved')
    expect(saveNow).toHaveBeenCalledOnce()
    expect(JSON.stringify(state.value)).not.toContain('a@example.com')
  })
})
