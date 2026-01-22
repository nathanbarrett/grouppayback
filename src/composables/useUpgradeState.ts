import { ref, computed } from 'vue'
import type { SavedListEntry } from '../types'

const STORAGE_KEY = 'grouppayback_saved_lists'

/**
 * Composable for managing saved list entries in localStorage
 * This tracks which upgraded lists the user has accessed
 */
export function useUpgradeState() {
  // Load saved lists from localStorage
  const savedLists = ref<SavedListEntry[]>(loadFromStorage())

  function loadFromStorage(): SavedListEntry[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return []
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return []
      return parsed as SavedListEntry[]
    } catch {
      return []
    }
  }

  function saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedLists.value))
    } catch {
      // Ignore storage errors (quota exceeded, etc.)
    }
  }

  /**
   * Add a new saved list entry
   */
  function addSavedList(id: string, name: string): void {
    // Check if already exists
    const existing = savedLists.value.find(list => list.id === id)
    if (existing) {
      // Update last accessed
      existing.lastAccessedAt = Date.now()
      existing.name = name || existing.name
    } else {
      const now = Date.now()
      savedLists.value.unshift({
        id,
        name: name || 'Untitled',
        createdAt: now,
        lastAccessedAt: now,
      })
    }
    saveToStorage()
  }

  /**
   * Update the name of a saved list
   */
  function updateSavedListName(id: string, name: string): void {
    const entry = savedLists.value.find(list => list.id === id)
    if (entry) {
      entry.name = name || 'Untitled'
      saveToStorage()
    }
  }

  /**
   * Update last accessed time for a list
   */
  function touchSavedList(id: string): void {
    const entry = savedLists.value.find(list => list.id === id)
    if (entry) {
      entry.lastAccessedAt = Date.now()
      saveToStorage()
    }
  }

  /**
   * Remove a saved list entry
   */
  function removeSavedList(id: string): void {
    const index = savedLists.value.findIndex(list => list.id === id)
    if (index !== -1) {
      savedLists.value.splice(index, 1)
      saveToStorage()
    }
  }

  /**
   * Get a saved list entry by ID
   */
  function getSavedList(id: string): SavedListEntry | undefined {
    return savedLists.value.find(list => list.id === id)
  }

  /**
   * Get lists sorted by last accessed (most recent first)
   */
  const recentLists = computed(() => {
    return [...savedLists.value].sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
  })

  /**
   * Check if user has any saved lists
   */
  const hasSavedLists = computed(() => savedLists.value.length > 0)

  return {
    savedLists,
    recentLists,
    hasSavedLists,
    addSavedList,
    updateSavedListName,
    touchSavedList,
    removeSavedList,
    getSavedList,
  }
}
