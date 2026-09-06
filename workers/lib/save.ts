import type { D1Database } from '@cloudflare/workers-types'
import type { AppState } from '../../src/types'
import { getList } from './db'
import { generateUlid } from './ulid'
import { sha256 } from './rateLimit'
import { buildSaveEmail, FROM_EMAIL } from './email'
export interface EmailEnvironment { EMAIL?: SendEmail; EMAIL_MODE?: string }
export class IdempotencyConflict extends Error {}
export async function saveEvent(db: D1Database, input: { key: string; email: string; title: string; data: AppState }, env: EmailEnvironment) {
 // Bind the immutable initial snapshot AND recipient. Include random key as salt;
 // never persist recipient or any provider error text. Hash remains private.
 const hash = await sha256(JSON.stringify([input.key, input.email, input.title, input.data]))
 const id = generateUlid()
 const now = Date.now()
 const inserted = await db.batch([
  db.prepare('INSERT INTO settlement_lists (id,data,version,created_at,updated_at,idempotency_key,request_hash) VALUES (?,?,1,?,?,?,?) ON CONFLICT(idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING').bind(id,JSON.stringify(input.data),now,now,input.key,hash),
  db.prepare("INSERT INTO save_receipts (list_id,email_status,updated_at) SELECT id,'pending',? FROM settlement_lists WHERE id=?").bind(now,id)
 ])
 const row = await db.prepare('SELECT id,request_hash FROM settlement_lists WHERE idempotency_key=?').bind(input.key).first<{id:string;request_hash:string}>()
 if (!row || row.request_hash !== hash) throw new IdempotencyConflict()
 const token = crypto.randomUUID()
 const claim = await db.prepare("UPDATE save_receipts SET email_status='sending',email_attempts=email_attempts+1,claim_token=?,updated_at=? WHERE list_id=? AND email_status IN ('pending','failed') AND email_attempts<3").bind(token,now,row.id).run()
 if (claim.meta.changes === 1) {
  // Never reclaim an uncertain/in-flight send: provider lacks idempotency support.
  // A crash or ambiguous transport failure stays pending rather than duplicating mail.
  let status = 'sending'
  if (env.EMAIL_MODE !== 'live' || !env.EMAIL) status = 'failed'
  else {
   try { await env.EMAIL.send({ from: { email: FROM_EMAIL, name: 'GroupPayback' }, to: input.email, ...buildSaveEmail({title:input.title,id:row.id}) }); status = 'sent' }
   catch {
    // Even TypeError can occur after acceptance. Never infer delivery from error type.
    console.error('EMAIL_SEND_UNCERTAIN')
    status = 'sending'
   }
  }
  await db.prepare('UPDATE save_receipts SET email_status=?,updated_at=? WHERE list_id=? AND claim_token=?').bind(status,Date.now(),row.id,token).run()
 }
 const receipt = await db.prepare('SELECT email_status FROM save_receipts WHERE list_id=?').bind(row.id).first<{email_status:string}>()
 const status = receipt?.email_status === 'sending' ? 'pending' : receipt?.email_status ?? 'pending'
 return { created: inserted[0]!.meta.changes === 1, response: { ...await getList(db,row.id), email: {status} } }
}
