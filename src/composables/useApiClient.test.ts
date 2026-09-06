import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useApiClient } from './useApiClient'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })
describe('save API', () => {
  it('sends required fields and exposes the server cooldown', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Too many requests', retryAfterSeconds: 42 }), { status: 429, headers: { 'Retry-After': '42' } }))
    vi.stubGlobal('fetch', fetcher)
    const request = { data: { people: [] }, email: 'a@example.com', title: 'Trip', idempotencyKey: 'key' }
    await expect(useApiClient().createList(request)).rejects.toMatchObject({ status: 429, retryAfterSeconds: 42 })
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(request)
  })
  it('serializes immediate saves with the latest version', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(new Response(JSON.stringify({ version: 3 })))
    vi.stubGlobal('fetch', fetcher)
    const version = ref(1)
    const saver = useApiClient().createAutoSaver(ref({ people: [] }), ref('saved'), version, value => { version.value = value })
    const first = saver.saveNow()
    saver.saveNow()
    expect(fetcher).toHaveBeenCalledTimes(1)
    finish(new Response(JSON.stringify({ version: 2 })))
    await first
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetcher.mock.calls[1]![1].body).version).toBe(2)
    saver.stop()
  })
})
