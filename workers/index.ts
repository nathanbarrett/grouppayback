import type { D1Database } from '@cloudflare/workers-types'
import { handleCreateList, handleGetList, handleUpdateList, jsonResponse } from './routes/lists'
import { ValidationError } from './lib/validate'
import { PUBLIC_ORIGIN } from './lib/email'
import type { EmailEnvironment } from './lib/save'
interface Env extends EmailEnvironment { DB: D1Database; ASSETS: Fetcher; ALLOWED_ORIGINS?: string }
export default {
 async fetch(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(request)
  const origin = request.headers.get('Origin')
  const allowed = [PUBLIC_ORIGIN,...(env.ALLOWED_ORIGINS?.split(',') ?? [])]
  const cors = (response: Response) => {
   response.headers.set('Vary','Origin')
   if (origin && allowed.includes(origin)) response.headers.set('Access-Control-Allow-Origin',origin)
   response.headers.set('Access-Control-Allow-Methods','GET, POST, PUT, OPTIONS')
   response.headers.set('Access-Control-Allow-Headers','Content-Type')
   return response
  }
  if (origin && !allowed.includes(origin)) return cors(jsonResponse({error:'Origin not allowed',code:'ORIGIN_NOT_ALLOWED'},403))
  if (request.method === 'OPTIONS') return cors(new Response(null,{status:204}))
  try {
   const match = path.match(/^\/api\/lists(?:\/([A-Z0-9]{26}))?$/i)
   if (match) {
    const id = match[1]?.toUpperCase()
    if (request.method === 'POST' && !id) return cors(await handleCreateList(request,env.DB,env))
    if (request.method === 'GET' && id) return cors(await handleGetList(id,env.DB))
    if (request.method === 'PUT' && id) return cors(await handleUpdateList(id,request,env.DB))
   }
   return cors(jsonResponse({error:'Not found'},404))
  } catch (error) {
   if (error instanceof ValidationError) return cors(jsonResponse({error:'Invalid request',code:error.code},error.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400))
   // Never log arbitrary error messages: provider and D1 errors may contain PII.
   console.error('API_INTERNAL_ERROR')
   return cors(jsonResponse({error:'Internal server error'},500))
  }
 }
}
