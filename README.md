# GroupPayback

> Production release approved on 2026-09-06, superseding the historical gates below. Root-domain Email Sending is enabled for `no-reply@grouppayback.com`; SPF, DKIM, DMARC and bounce MX resolve. Production uses `EMAIL_MODE = "live"`; local/default stays mock. Migrations 0000–0002 are applied remotely. The existing apex custom domain and exact `grouppayback.nathan-barrett.workers.dev` serving hostname were verified. No live test email was sent: recipient consent and inbox delivery verification remain outstanding.

A bill-splitting app with no accounts. Start with a URL-backed event, then optionally save a shared cloud event. Anyone holding either share link can view and edit its contents; share only with people you trust.

## Architecture and privacy

- Vue 3, TypeScript, Vite and Tailwind CSS v4 frontend.
- Cloudflare **Workers with Static Assets**, not Cloudflare Pages. The Worker serves the SPA and `/api/lists` endpoints.
- URL mode encodes event data in the share link. Cloud mode persists event data and versions in **D1**, with optimistic-concurrency PUT updates.
- Save-event POST uses an immutable idempotency key and a claimed email receipt to prevent duplicate lists/mail. Recipient plaintext is not stored in D1 or application state. A private SHA-256 request fingerprint is stored: it is not encryption and may permit dictionary attacks if the database is compromised.
- Email links use `https://grouppayback.com`. Production **EMAIL_MODE remains `mock`** until explicit release approval. Mock saves do not deliver email and currently report `failed`; retries consume quota and are capped at three attempts. Uncertain provider outcomes remain `pending` and are never automatically resent. Logs contain only the constant `EMAIL_SEND_UNCERTAIN`, not provider messages or recipient data.
- POST rate limits use the trusted edge IP: IPv4 per address, IPv6 per /64, and mapped IPv4 shares its IPv4 bucket. Ten requests per rolling five minutes. Each POST atomically prunes up to 100 expired rows before quota insertion; an indexed timestamp bounds cleanup scanning. Expired rows can remain while traffic is idle; this is not a scheduled retention guarantee.

## Development and verification

```sh
npm install
npm run dev                 # frontend Vite server
npm run test:run
npm run typecheck:app
npm run typecheck:workers
npm run build
wrangler d1 migrations apply grouppayback --local
wrangler dev --local        # built frontend plus local Worker/D1
```

Local/default config has no email binding and remains in mock mode. Never enable a remote email binding for development.

## Database migrations

Use tracked migrations, not repeated execution of `schema.sql`, to upgrade a database:

- `0000_initial.sql`: initial lists table/index.
- `0001_save_event.sql`: idempotency, email receipts and rate events.
- `0002_rate_limit_pruning.sql`: timestamp index for bounded rate cleanup.

`schema.sql` is a current-schema bootstrap/reference for fresh databases, not an upgrade path for old tables. Its CREATE statements are rerunnable, but do not add missing columns to existing tables. Do not combine bootstrap SQL with migration tracking on the same database.

## Deployment: explicit release gates

Nothing in this correction pass deploys or sends email. The completed Fable review is historical evidence, **not production approval**. The recovered focused Claude Opus 5 high fix review reports PASS (see `docs/opus-fix-review.md` for mixed-model usage and missing source-baseline limitations). Exact-head final PR review is still required before release.

1. Confirm which Worker owns the apex/custom domains and every hostname that actually serves the app. `PUBLIC_ORIGIN` allows only the apex by default; `www` or workers.dev traffic needs an approved allowlist or canonical redirect. Do not guess or broaden CORS speculatively.
2. Complete reviews, inspect pending remote migrations, then obtain authorization for remote writes.
3. Apply remote migrations **before** deploying the new Worker:
   ```sh
   wrangler d1 migrations list grouppayback --remote --env production
   # Only after authorization:
   wrangler d1 migrations apply grouppayback --remote --env production
   npm run deploy:prod
   ```
4. Leave `EMAIL_MODE = "mock"` until sender onboarding and one explicitly approved live send to Nathan's own address. Verify builder-style send support under the configured compatibility date and delivery before enabling live email generally.

`npm run deploy` intentionally exits with an error before invoking Wrangler. Default and production config target the same Worker, so plain `wrangler deploy` is unsafe: it can replace production bindings/origins with local defaults. Use only the explicit production script after the above gates. Production deployment is not authorized merely by this README.

## License

MIT
