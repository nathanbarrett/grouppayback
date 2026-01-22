import { ref, watch, type Ref } from 'vue'
import type { AppState, ApiListResponse, ApiErrorResponse } from '../types'

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
  async function createList(data: AppState): Promise<ApiListResponse> {
    const response = await fetch(`${API_BASE}/lists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    })

    if (!response.ok) {
      const error = (await response.json()) as ApiErrorResponse
      throw new Error(error.error || 'Failed to create list')
    }

    return (await response.json()) as ApiListResponse
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
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let pendingSave = false

    async function performSave() {
      if (!listId.value || listVersion.value === 0) return

      isSaving.value = true
      saveError.value = null

      try {
        const result = await updateList(
          listId.value,
          state.value,
          listVersion.value
        )
        onVersionUpdate(result.version)
      } catch (err) {
        if (err instanceof VersionConflictError) {
          saveError.value = 'Someone else edited this list. Please refresh.'
        } else {
          saveError.value = err instanceof Error ? err.message : 'Failed to save'
        }
      } finally {
        isSaving.value = false
      }
    }

    function debouncedSave() {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      pendingSave = true
      debounceTimer = setTimeout(async () => {
        if (pendingSave) {
          pendingSave = false
          await performSave()
        }
      }, SAVE_DEBOUNCE_MS)
    }

    // Watch for state changes and trigger debounced save
    const stopWatch = watch(
      state,
      () => {
        // Only auto-save when in ULID mode with valid version
        if (listId.value && listVersion.value > 0) {
          debouncedSave()
        }
      },
      { deep: true }
    )

    // Return cleanup function
    return () => {
      stopWatch()
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
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
