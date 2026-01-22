import type { D1Database } from '@cloudflare/workers-types'
import {
  handleCreateList,
  handleGetList,
  handleUpdateList,
} from './routes/lists'

/**
 * Worker environment bindings
 */
interface Env {
  DB: D1Database
  ASSETS: Fetcher
}

/**
 * CORS headers for API responses
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

/**
 * Add CORS headers to a response
 */
function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

/**
 * Route API requests
 */
async function handleApiRequest(
  request: Request,
  env: Env,
  pathname: string
): Promise<Response> {
  const method = request.method

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return handleOptions()
  }

  // Extract route parameters
  const listsMatch = pathname.match(/^\/api\/lists(?:\/([A-Z0-9]{26}))?$/i)

  if (listsMatch) {
    const id = listsMatch[1]

    // POST /api/lists - Create new list
    if (method === 'POST' && !id) {
      const response = await handleCreateList(request, env.DB)
      return withCors(response)
    }

    // GET /api/lists/:id - Get list by ID
    if (method === 'GET' && id) {
      const response = await handleGetList(id.toUpperCase(), env.DB)
      return withCors(response)
    }

    // PUT /api/lists/:id - Update list
    if (method === 'PUT' && id) {
      const response = await handleUpdateList(id.toUpperCase(), request, env.DB)
      return withCors(response)
    }
  }

  // Method not allowed or route not found
  return withCors(
    new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  )
}

/**
 * Main Worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    // Route API requests
    if (pathname.startsWith('/api/')) {
      try {
        return await handleApiRequest(request, env, pathname)
      } catch (error) {
        console.error('API Error:', error)
        return withCors(
          new Response(
            JSON.stringify({ error: 'Internal server error' }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          )
        )
      }
    }

    // Serve static assets for non-API routes
    return env.ASSETS.fetch(request)
  },
}
