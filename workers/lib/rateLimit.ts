import type { D1Database } from '@cloudflare/workers-types'
export async function sha256(value: string): Promise<string> {
 const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
 return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
}
export async function bucketKeyFromRequest(request: Request): Promise<string> {
 // Only the edge-controlled header is trusted; absent headers share one bucket.
 const ip = request.headers.get('CF-Connecting-IP')?.trim().toLowerCase() || 'no-ip'
 try {
  if (!ip.includes(':')) {
   if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) || ip.split('.').some(n => Number(n) > 255)) return sha256('no-ip')
   return sha256(ip.split('.').map(Number).join('.'))
  }
  // WHATWG validates and canonicalizes IPv6, including dotted mapped IPv4.
  const host = new URL(`http://[${ip}]/`).hostname.slice(1, -1)
  const halves = host.split('::')
  const left = halves[0] ? halves[0].split(':') : []
  const right = halves[1] ? halves[1].split(':') : []
  const words = (halves.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left).map(w => parseInt(w, 16))
  if (words.slice(0, 5).every(w => w === 0) && words[5] === 0xffff) {
   return sha256([words[6]! >> 8, words[6]! & 255, words[7]! >> 8, words[7]! & 255].join('.'))
  }
  return sha256(`ipv6:${words.slice(0, 4).map(w => w.toString(16)).join(':')}/64`)
 } catch { return sha256('no-ip') }
}
export async function consumeRateLimitToken(db: D1Database, bucket: string, now = Date.now()) {
 // Cleanup and conditional INSERT share a D1 transaction; no count/write gap.
 // Bound cleanup work per POST (including rejected requests).
 const [, result] = await db.batch([
  pruneRateLimitEvents(db, now),
  db.prepare(`INSERT INTO rate_limit_events (bucket, ts)
 SELECT ?1, ?2 WHERE (SELECT COUNT(*) FROM rate_limit_events WHERE bucket = ?1 AND ts > ?2 - 300000) < 10`).bind(bucket, now)
 ])
 if (result!.meta.changes === 1) return { allowed: true, retryAfterSeconds: 0 }
 const row = await db.prepare('SELECT MIN(ts) AS oldest FROM rate_limit_events WHERE bucket = ? AND ts > ?').bind(bucket, now - 300000).first<{ oldest: number }>()
 return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(((row?.oldest ?? now) + 300000 - now) / 1000)) }
}
function pruneRateLimitEvents(db: D1Database, now: number) {
 return db.prepare('DELETE FROM rate_limit_events WHERE id IN (SELECT id FROM rate_limit_events WHERE ts <= ? ORDER BY ts LIMIT 100)').bind(now - 300000)
}
