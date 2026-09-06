import { beforeAll, afterAll, it, expect, vi } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import worker from '../index'
let mf: Miniflare
let db: D1Database
beforeAll(async () => {
 mf = new Miniflare({ modules: true, script: 'export default { fetch() { return new Response() } }', d1Databases: ['DB'] })
 db = await mf.getD1Database('DB') as unknown as D1Database
 for (const f of ['0000_initial.sql','0001_save_event.sql', '0002_rate_limit_pruning.sql']) for (const sql of readFileSync(`migrations/${f}`, 'utf8').split(';').filter(s=>s.trim())) await db.prepare(sql).run()
},20000)
afterAll(async()=>{await mf?.dispose()})
it('serializes concurrent twins, counts replay requests, and fails closed without email configuration', async () => {
 let sends = 0
 const env = { DB:db, ASSETS:{fetch:async()=>new Response()}, EMAIL_MODE:'live', EMAIL:{send:async()=>{sends++; return {messageId:'test'}}} }
 const body = {data:{people:[]},title:'Concurrent',email:'private@example.com',idempotencyKey:crypto.randomUUID()}
 const post = (e=env) => worker.fetch(new Request('https://grouppayback.com/api/lists',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.99'},body:JSON.stringify(body)}),e as never)
 const responses = await Promise.all(Array.from({length:10},()=>post()))
 expect(responses.filter(r=>r.status===201)).toHaveLength(1)
 expect(sends).toBe(1)
 const ids = await Promise.all(responses.map(async r=>(await r.json() as {id:string}).id))
 expect(new Set(ids).size).toBe(1)
 const limited = await post()
 expect(limited.status).toBe(429)
 expect(limited.headers.get('Retry-After')).toBeTruthy()
 const missing = await worker.fetch(new Request('https://grouppayback.com/api/lists',{method:'POST',body:JSON.stringify({...body,idempotencyKey:crypto.randomUUID()})}),{DB:db,ASSETS:env.ASSETS} as never)
 expect(missing.status).toBe(201)
 expect((await missing.json() as {email:{status:string}}).email.status).toBe('failed')
})
it('saves and binds replay to recipient and payload without leaking private metadata', async()=>{
 let sends = 0
 const env = { DB: db, ASSETS: { fetch: async()=>new Response() }, EMAIL_MODE: 'live', EMAIL: { send: async()=>{ sends++; return {messageId:'test'} } } }
 const body = { data: { people: [], email:'private@example.com' }, title:'Trip', email:'private@example.com', idempotencyKey:crypto.randomUUID() }
 const post = (b=body) => worker.fetch(new Request('https://evil.example/api/lists',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify(b)}),env as never)
 const first = await post()
 expect(first.status).toBe(201)
 const saved = await first.json() as { id: string; email: { status: string } }
 expect(saved.email.status).toBe('sent')
 expect(JSON.stringify(saved)).not.toContain('private@')
 expect((await post()).status).toBe(200)
 expect(sends).toBe(1)
 expect((await post({...body,email:'other@example.com'})).status).toBe(409)
 expect((await post({...body,title:'Other'})).status).toBe(409)
 const get = await worker.fetch(new Request(`https://grouppayback.com/api/lists/${saved.id}`),env as never)
 expect(await get.text()).not.toMatch(/private@|idempotency|request_hash/)
 const put = await worker.fetch(new Request(`https://grouppayback.com/api/lists/${saved.id}`,{method:'PUT',body:JSON.stringify({version:1,data:body.data})}),env as never)
 expect(put.status).toBe(200)
 expect(await put.text()).not.toContain('private@')
})

it('logs only a constant for provider throws and never reclaims uncertain delivery, including TypeError', async () => {
 const log = vi.spyOn(console, 'error').mockImplementation(() => {})
 try {
  for (const error of [new Error('private@example.com secret'), new TypeError('private@example.com secret')]) {
   const send = vi.fn(async () => { throw error })
   const env = {DB:db, ASSETS:{fetch:async()=>new Response()}, EMAIL_MODE:'live', EMAIL:{send}}
   const body = {data:{people:[]},title:'Throw',email:'private@example.com',idempotencyKey:crypto.randomUUID()}
   const post = () => worker.fetch(new Request('https://grouppayback.com/api/lists',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.50'},body:JSON.stringify(body)}),env as never)
   for (let i=0;i<2;i++) expect((await (await post()).json() as {email:{status:string}}).email.status).toBe('pending')
   expect(send).toHaveBeenCalledTimes(1)
  }
  expect(log.mock.calls).toEqual([['EMAIL_SEND_UNCERTAIN'], ['EMAIL_SEND_UNCERTAIN']])
 } finally { log.mockRestore() }
})
it('rejects foreign origins before consuming quota or touching storage', async () => {
 const env = {DB:db,ASSETS:{fetch:async()=>new Response()}}
 const before = await db.prepare('SELECT COUNT(*) AS n FROM rate_limit_events').first()
 for (const method of ['POST','PUT','OPTIONS']) {
  const response = await worker.fetch(new Request('https://grouppayback.com/api/lists',{method,headers:{Origin:'https://evil.example'}}),env as never)
  expect(response.status).toBe(403)
  expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
 }
 expect(await db.prepare('SELECT COUNT(*) AS n FROM rate_limit_events').first()).toEqual(before)
})
it('caps definitive failed attempts at three, even if live becomes available', async () => {
 const send = vi.fn(async()=>({messageId:'test'}))
 const env = {DB:db,ASSETS:{fetch:async()=>new Response()},EMAIL_MODE:'mock',EMAIL:{send}}
 const body = {data:{people:[]},title:'Cap',email:'private@example.com',idempotencyKey:crypto.randomUUID()}
 const post = () => worker.fetch(new Request('https://grouppayback.com/api/lists',{method:'POST',headers:{'CF-Connecting-IP':'192.0.2.51'},body:JSON.stringify(body)}),env as never)
 for(let i=0;i<3;i++) await post()
 env.EMAIL_MODE='live'
 const saved = await (await post()).json() as {id:string;email:{status:string}}
 expect(saved.email.status).toBe('failed')
 expect(send).not.toHaveBeenCalled()
 expect((await db.prepare('SELECT email_attempts FROM save_receipts WHERE list_id=?').bind(saved.id).first<{email_attempts:number}>())?.email_attempts).toBe(3)
})
it('rejects oversized PUT from both declared size and streamed body', async () => {
 const env = {DB:db,ASSETS:{fetch:async()=>new Response()}}
 for (const headers of [new Headers(), new Headers({'Content-Length':'262145'})]) {
  const response = await worker.fetch(new Request('https://grouppayback.com/api/lists/01ARZ3NDEKTSV4RRFFQ69G5FAV',{method:'PUT',headers,body:'x'.repeat(262145)}),env as never)
  expect(response.status).toBe(413)
 }
})
