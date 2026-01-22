import type { D1Database } from '@cloudflare/workers-types'
import type { AppState } from '../../src/types'

/**
 * Database row type for settlement_lists table
 */
export interface SettlementListRow {
  id: string
  data: string // JSON string of AppState
  version: number
  created_at: number // Unix timestamp in ms
  updated_at: number // Unix timestamp in ms
}

/**
 * Parsed settlement list with data as AppState
 */
export interface SettlementList {
  id: string
  data: AppState
  version: number
  createdAt: number
  updatedAt: number
}

/**
 * Error thrown when a version conflict occurs during update
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

/**
 * Error thrown when a list is not found
 */
export class NotFoundError extends Error {
  constructor(id: string) {
    super(`Settlement list not found: ${id}`)
    this.name = 'NotFoundError'
  }
}

/**
 * Converts a database row to a SettlementList object
 */
function rowToList(row: SettlementListRow): SettlementList {
  return {
    id: row.id,
    data: JSON.parse(row.data) as AppState,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Creates a new settlement list in the database
 *
 * @param db - D1 database instance
 * @param id - ULID for the new list
 * @param data - AppState to store
 * @returns The created settlement list
 */
export async function createList(
  db: D1Database,
  id: string,
  data: AppState
): Promise<SettlementList> {
  const now = Date.now()
  const jsonData = JSON.stringify(data)

  await db
    .prepare(
      `INSERT INTO settlement_lists (id, data, version, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)`
    )
    .bind(id, jsonData, now, now)
    .run()

  return {
    id,
    data,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Gets a settlement list by ID
 *
 * @param db - D1 database instance
 * @param id - ULID of the list
 * @returns The settlement list or null if not found
 */
export async function getList(
  db: D1Database,
  id: string
): Promise<SettlementList | null> {
  const row = await db
    .prepare('SELECT * FROM settlement_lists WHERE id = ?')
    .bind(id)
    .first<SettlementListRow>()

  if (!row) {
    return null
  }

  return rowToList(row)
}

/**
 * Updates a settlement list with optimistic locking
 *
 * @param db - D1 database instance
 * @param id - ULID of the list
 * @param data - New AppState data
 * @param expectedVersion - Expected version for optimistic locking
 * @returns The updated settlement list
 * @throws NotFoundError if list doesn't exist
 * @throws VersionConflictError if version doesn't match
 */
export async function updateList(
  db: D1Database,
  id: string,
  data: AppState,
  expectedVersion: number
): Promise<SettlementList> {
  const now = Date.now()
  const jsonData = JSON.stringify(data)
  const newVersion = expectedVersion + 1

  const result = await db
    .prepare(
      `UPDATE settlement_lists
       SET data = ?, version = ?, updated_at = ?
       WHERE id = ? AND version = ?`
    )
    .bind(jsonData, newVersion, now, id, expectedVersion)
    .run()

  if (result.meta.changes === 0) {
    // Check if list exists to determine error type
    const existing = await db
      .prepare('SELECT version FROM settlement_lists WHERE id = ?')
      .bind(id)
      .first<{ version: number }>()

    if (!existing) {
      throw new NotFoundError(id)
    }

    throw new VersionConflictError(expectedVersion, existing.version)
  }

  return {
    id,
    data,
    version: newVersion,
    createdAt: 0, // Not returned by update, caller should have this
    updatedAt: now,
  }
}

/**
 * Deletes a settlement list by ID
 *
 * @param db - D1 database instance
 * @param id - ULID of the list
 * @returns true if deleted, false if not found
 */
export async function deleteList(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM settlement_lists WHERE id = ?')
    .bind(id)
    .run()

  return result.meta.changes > 0
}
