import type { D1Database } from '@cloudflare/workers-types'
import type { AppState } from '../../src/types'
import { generateUlid, isValidUlid } from '../lib/ulid'
import {
  createList,
  getList,
  updateList,
  NotFoundError,
  VersionConflictError,
} from '../lib/db'

/**
 * API response types
 */
interface CreateListRequest {
  data: AppState
}

interface UpdateListRequest {
  data: AppState
  version: number
}

interface ListResponse {
  id: string
  data: AppState
  version: number
  createdAt: number
  updatedAt: number
}

interface ErrorResponse {
  error: string
  code?: string
  expectedVersion?: number
  actualVersion?: number
}

/**
 * Helper to create JSON response
 */
function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Helper to create error response
 */
function errorResponse(
  message: string,
  status: number,
  extras?: Partial<ErrorResponse>
): Response {
  return jsonResponse<ErrorResponse>({ error: message, ...extras }, status)
}

/**
 * Validates AppState structure
 */
function isValidAppState(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false

  const state = data as Record<string, unknown>
  if (!Array.isArray(state.people)) return false

  for (const person of state.people) {
    if (typeof person !== 'object' || !person) return false
    const p = person as Record<string, unknown>
    if (typeof p.id !== 'string' || typeof p.name !== 'string') return false
    if (!Array.isArray(p.items)) return false

    for (const item of p.items) {
      if (typeof item !== 'object' || !item) return false
      const i = item as Record<string, unknown>
      if (
        typeof i.id !== 'string' ||
        typeof i.name !== 'string' ||
        typeof i.amountCents !== 'number'
      )
        return false
    }
  }

  if (state.currency !== undefined && typeof state.currency !== 'string')
    return false
  if (state.eventName !== undefined && typeof state.eventName !== 'string')
    return false

  return true
}

/**
 * POST /api/lists - Create a new list
 */
export async function handleCreateList(
  request: Request,
  db: D1Database
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const reqBody = body as CreateListRequest
  if (!reqBody.data || !isValidAppState(reqBody.data)) {
    return errorResponse('Invalid or missing data field', 400)
  }

  const id = generateUlid()
  const list = await createList(db, id, reqBody.data)

  const response: ListResponse = {
    id: list.id,
    data: list.data,
    version: list.version,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }

  return jsonResponse(response, 201)
}

/**
 * GET /api/lists/:id - Get a list by ID
 */
export async function handleGetList(
  id: string,
  db: D1Database
): Promise<Response> {
  if (!isValidUlid(id)) {
    return errorResponse('Invalid list ID format', 400)
  }

  const list = await getList(db, id)
  if (!list) {
    return errorResponse('List not found', 404)
  }

  const response: ListResponse = {
    id: list.id,
    data: list.data,
    version: list.version,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }

  return jsonResponse(response)
}

/**
 * PUT /api/lists/:id - Update a list
 */
export async function handleUpdateList(
  id: string,
  request: Request,
  db: D1Database
): Promise<Response> {
  if (!isValidUlid(id)) {
    return errorResponse('Invalid list ID format', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const reqBody = body as UpdateListRequest
  if (!reqBody.data || !isValidAppState(reqBody.data)) {
    return errorResponse('Invalid or missing data field', 400)
  }

  if (typeof reqBody.version !== 'number' || reqBody.version < 1) {
    return errorResponse('Invalid or missing version field', 400)
  }

  try {
    const list = await updateList(db, id, reqBody.data, reqBody.version)

    // Get full list to include createdAt
    const fullList = await getList(db, id)

    const response: ListResponse = {
      id: list.id,
      data: list.data,
      version: list.version,
      createdAt: fullList?.createdAt ?? 0,
      updatedAt: list.updatedAt,
    }

    return jsonResponse(response)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse('List not found', 404)
    }
    if (error instanceof VersionConflictError) {
      return errorResponse('Version conflict', 409, {
        code: 'VERSION_CONFLICT',
        expectedVersion: error.expectedVersion,
        actualVersion: error.actualVersion,
      })
    }
    throw error
  }
}
