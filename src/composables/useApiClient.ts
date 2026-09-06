import { ref, watch, type Ref } from 'vue'
import type { AppState, ApiListResponse, ApiErrorResponse, ApiCreateListRequest, ApiCreateListResponse } from '../types'

const API_BASE = '/api'

// Debounce delay for auto-saving (ms)
const SAVE_DEBOUNCE_MS = 1000

/**
 * API client for settlement lists
 */
export function useApiClient() {
  const isSaving = ref(false)
  const saveError = ref<string | null>(null)
  const isLoading = ref(false)
  const loadError = ref<string | null>(null)

  /**
   * Create a new list in the database
   */
  async function createList(request: ApiCreateListRequest): Promise<ApiCreateListResponse> {
    const response = await fetch(`${API_BASE}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as Partial<ApiErrorResponse>
      const seconds = Number(response.headers.get('Retry-After') || error.retryAfterSeconds || 300)
      throw Object.assign(new Error(error.error || 'Failed to save event'), { status: response.status, code: error.code, retryAfterSeconds: Number.isFinite(seconds) ? Math.max(1, seconds) : 300 })
    }
    return (await response.json()) as ApiCreateListResponse
  }

  /**
   * Get a list by ID
   */
  async function getList(id: string): Promise<ApiListResponse> {
    isLoading.value = true
    loadError.value = null

    try {
      const response = await fetch(`${API_BASE}/lists/${id}`)

      if (!response.ok) {
        const error = (await response.json()) as ApiErrorResponse
        throw new Error(error.error || 'Failed to load list')
      }

      return (await response.json()) as ApiListResponse
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load list'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Update an existing list
   */
  async function updateList(
    id: string,
    data: AppState,
    version: number
  ): Promise<ApiListResponse> {
    const response = await fetch(`${API_BASE}/lists/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, version }),
    })

    if (!response.ok) {
      const error = (await response.json()) as ApiErrorResponse
      if (error.code === 'VERSION_CONFLICT') {
        throw new VersionConflictError(
          error.expectedVersion ?? 0,
          error.actualVersion ?? 0
        )
      }
      throw new Error(error.error || 'Failed to save list')
    }

    return (await response.json()) as ApiListResponse
  }

  /**
   * Create an auto-save watcher for ULID mode
   *
   * @param state - Reactive state ref
   * @param listId - Reactive list ID ref
   * @param listVersion - Reactive list version ref
   * @param onVersionUpdate - Callback when version is updated after save
   */
  function createAutoSaver(
    state: Ref<AppState>,
    listId: Ref<string | null>,
    listVersion: Ref<number>,
    onVersionUpdate: (version: number) => void
  ) {
    let timer: ReturnType<typeof setTimeout> | null = null
    let inFlight: Promise<void> | null = null
    let dirty = false
    let stopped = false

    function saveNow(): Promise<void> {
      if (timer) { clearTimeout(timer); timer = null }
      if (stopped || !listId.value || listVersion.value === 0) return Promise.resolve()
      dirty = true
      if (inFlight) return inFlight
      inFlight = (async () => {
        isSaving.value = true
        saveError.value = null
        try {
          while (dirty && !stopped && listId.value && listVersion.value > 0) {
            dirty = false
            const id = listId.value
            const result = await updateList(id, JSON.parse(JSON.stringify(state.value)), listVersion.value)
            if (stopped || listId.value !== id) break
            onVersionUpdate(result.version)
          }
        } catch (err) {
          if (!stopped) saveError.value = err instanceof VersionConflictError
            ? 'Someone else edited this list. Please refresh.'
            : err instanceof Error ? err.message : 'Failed to save'
        } finally {
          isSaving.value = false
          inFlight = null
        }
      })()
      return inFlight
    }
    const stopWatch = watch(state, () => {
      if (!listId.value || listVersion.value === 0) return
      if (inFlight) { dirty = true; return }
      if (timer) clearTimeout(timer)
      timer = setTimeout(saveNow, SAVE_DEBOUNCE_MS)
    }, { deep: true, flush: 'sync' })
    function stop() {
      stopped = true
      stopWatch()
      if (timer) clearTimeout(timer)
    }
    return { stop, saveNow }
  }

  return {
    isSaving,
    saveError,
    isLoading,
    loadError,
    createList,
    getList,
    updateList,
    createAutoSaver,
  }
}

/**
 * Error thrown when a version conflict occurs
 */
export class VersionConflictError extends Error {
  expectedVersion: number
  actualVersion: number

  constructor(expectedVersion: number, actualVersion: number) {
    super(`Version conflict: expected ${expectedVersion}, got ${actualVersion}`)
    this.name = 'VersionConflictError'
    this.expectedVersion = expectedVersion
    this.actualVersion = actualVersion
  }
}
