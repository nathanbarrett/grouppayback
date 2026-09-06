import { beforeAll, afterAll, it, expect } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { consumeRateLimitToken, bucketKeyFromRequest } from './rateLimit'
let mf: Miniflare
let db: D1Database
beforeAll(async () => {
  mf = new Miniflare({ workers: [{ name: 'test', compatibilityDate: '2025-01-01', modules: true, script: 'export default { fetch() { return new Response() } }', d1Databases: ['DB'] }] })
  db = await mf.getD1Database('DB') as unknown as D1Database
  for (const file of ['0000_initial.sql', '0001_save_event.sql', '0002_rate_limit_pruning.sql']) {
    for (const sql of readFileSync(`migrations/${file}`, 'utf8').split(';').filter(s => s.trim())) await db.prepare(sql).run()
  }
}, 20000)
afterAll(async () => { await mf?.dispose() })
it('normalizes equivalent IPv6 representations and ignores spoofable forwarding', async () => {
 const bucket = (ip: string) => bucketKeyFromRequest(new Request('https://grouppayback.com',{headers:{'CF-Connecting-IP':ip}}))
 expect(await bucket('2001:db8::1')).toBe(await bucket('2001:0db8:0:0:0:0:0:1'))
 expect(await bucket('2001:db8::1')).toBe(await bucket('2001:db8::ffff:abcd'))
 expect(await bucket('2001:db8:0:1::1')).not.toBe(await bucket('2001:db8::1'))
 expect(await bucket('::ffff:192.0.2.1')).toBe(await bucket('192.0.2.1'))
 expect(await bucket('0:0:0:0:0:ffff:c000:201')).toBe(await bucket('192.0.2.1'))
 expect(await bucket('::ffff:192.0.2.2')).not.toBe(await bucket('192.0.2.1'))
 expect(await bucket('invalid')).toBe(await bucket(''))
 expect(await bucketKeyFromRequest(new Request('https://grouppayback.com',{headers:{'X-Forwarded-For':'evil'}}))).toBe(await bucketKeyFromRequest(new Request('https://grouppayback.com')))
})
it('atomically enforces ten requests globally with a rolling boundary', async () => {
  const results = await Promise.all(Array.from({ length: 30 }, () => consumeRateLimitToken(db, 'a', 1000000)))
  expect(results.filter(r => r.allowed)).toHaveLength(10)
  expect(await consumeRateLimitToken(db, 'a', 1299999)).toEqual({ allowed: false, retryAfterSeconds: 1 })
  expect((await consumeRateLimitToken(db, 'a', 1300000)).allowed).toBe(true)
  expect((await consumeRateLimitToken(db, 'b', 1000000)).allowed).toBe(true)
})

it('prunes at most 100 expired rows on consumption without deleting active tokens', async () => {
 await db.prepare('DELETE FROM rate_limit_events').run()
 await db.batch(Array.from({length:150}, () => db.prepare('INSERT INTO rate_limit_events(bucket,ts) VALUES (?,?)').bind('expired', 1)))
 await consumeRateLimitToken(db, 'current', 1000000)
 expect((await db.prepare('SELECT COUNT(*) AS n FROM rate_limit_events WHERE bucket=?').bind('expired').first<{n:number}>())?.n).toBe(50)
 const results = await Promise.all(Array.from({length:30}, () => consumeRateLimitToken(db, 'current', 1000000)))
 expect(results.filter(r => r.allowed)).toHaveLength(9)
 expect((await db.prepare('SELECT COUNT(*) AS n FROM rate_limit_events WHERE bucket=?').bind('expired').first<{n:number}>())?.n).toBe(0)
})
