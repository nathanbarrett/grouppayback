import type { D1Database } from '@cloudflare/workers-types'
import { isValidUlid } from '../lib/ulid'
import { getList, updateList, NotFoundError, VersionConflictError } from '../lib/db'
import { sanitizeAppState, validateEmail, validateTitle, validateIdempotencyKey, ValidationError } from '../lib/validate'
import { saveEvent, IdempotencyConflict } from '../lib/save'
import type { EmailEnvironment } from '../lib/save'
import { consumeRateLimitToken, bucketKeyFromRequest } from '../lib/rateLimit'
export function jsonResponse(data: unknown, status = 200): Response {
 return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' } })
}
export async function readBody(request: Request): Promise<Record<string,unknown>> {
 const max = 256 * 1024
 if (Number(request.headers.get('Content-Length')) > max) throw new ValidationError('PAYLOAD_TOO_LARGE')
 const reader = request.body?.getReader()
 if (!reader) throw new ValidationError('INVALID_JSON')
 const chunks: Uint8Array[] = []
 let size = 0
 while (true) {
  const {done,value} = await reader.read()
  if (done) break
  size += value.byteLength
  if (size > max) { await reader.cancel(); throw new ValidationError('PAYLOAD_TOO_LARGE') }
  chunks.push(value)
 }
 const bytes = new Uint8Array(size)
 let offset = 0
 for (const chunk of chunks) { bytes.set(chunk,offset); offset += chunk.length }
 try {
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error()
  return body as Record<string,unknown>
 } catch { throw new ValidationError('INVALID_JSON') }
}
export async function handleCreateList(request: Request, db: D1Database, env: EmailEnvironment = {}): Promise<Response> {
 // Every POST request (including invalid bodies and replays) consumes the global quota.
 const rate = await consumeRateLimitToken(db,await bucketKeyFromRequest(request))
 if (!rate.allowed) {
  const response = jsonResponse({error:'Too many requests',code:'RATE_LIMITED',retryAfterSeconds:rate.retryAfterSeconds},429)
  response.headers.set('Retry-After',String(rate.retryAfterSeconds))
  return response
 }
 const body = await readBody(request)
 const key = validateIdempotencyKey(body.idempotencyKey)
 const email = validateEmail(body.email)
 const title = validateTitle(body.title)
 const data = sanitizeAppState(body.data)
 data.eventName = title
 try {
  const result = await saveEvent(db,{key,email,title,data},env)
  return jsonResponse(result.response,result.created ? 201 : 200)
 } catch (error) {
  if (error instanceof IdempotencyConflict) return jsonResponse({error:'Idempotency key already used for a different request',code:'IDEMPOTENCY_CONFLICT'},409)
  throw error
 }
}
export async function handleGetList(id: string, db: D1Database): Promise<Response> {
 if (!isValidUlid(id)) return jsonResponse({error:'Invalid list ID'},400)
 const list = await getList(db,id)
 return list ? jsonResponse(list) : jsonResponse({error:'List not found'},404)
}
export async function handleUpdateList(id: string, request: Request, db: D1Database): Promise<Response> {
 if (!isValidUlid(id)) return jsonResponse({error:'Invalid list ID'},400)
 const body = await readBody(request)
 const data = sanitizeAppState(body.data)
 if (typeof body.version !== 'number' || !Number.isSafeInteger(body.version) || body.version < 1) throw new ValidationError('INVALID_VERSION')
 try {
  const list = await updateList(db,id,data,body.version)
  const full = await getList(db,id)
  return jsonResponse({...list,createdAt:full?.createdAt ?? 0})
 } catch (error) {
  if (error instanceof NotFoundError) return jsonResponse({error:'List not found'},404)
  if (error instanceof VersionConflictError) return jsonResponse({error:'Version conflict',code:'VERSION_CONFLICT',expectedVersion:error.expectedVersion,actualVersion:error.actualVersion},409)
  throw error
 }
}
