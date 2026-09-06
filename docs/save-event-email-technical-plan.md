# Save event email — Claude technical plan

Historical planning proposal only; not current implementation or deployment instructions. See README.md and email-preflight.md for current retry semantics, rate limits, safe deploy commands, and release gates.

# GroupPayback "Save event" (email a share link) — Technical Plan

Status: planning only. No code, config, migrations, remote resources, or deployments have been changed. Mockup and email design are proposals awaiting Nathan's approval.

## 1. What exists today (inspection summary)

- **Worker entry** `workers/index.ts`: routes `/api/lists` (POST create, GET/PUT by 26-char ULID), CORS `*`, everything else to `env.ASSETS`. `Env` is hand-written with `DB` and `ASSETS` only. Errors are caught and logged with `console.error('API Error:', error)`.
- **Route handlers** `workers/routes/lists.ts`: `isValidAppState` checks shape but has no length or size bounds and passes the client object through unchanged to storage, so unknown top-level keys are persisted and later served by GET.
- **DB layer** `workers/lib/db.ts`: `createList` plain INSERT, `updateList` optimistic lock on `version`, `getList` uses `SELECT *`.
- **Schema** `schema.sql`: one table `settlement_lists`, applied by hand. No migrations directory, no `d1_migrations` tracking.
- **Types**: `@cloudflare/workers-types` installed is `4.20260122.0`. It already declares the new `SendEmail.send({ from, to, subject, text, html, ... })` builder overload, so the Email Service binding is typeable today. No `worker-configuration.d.ts` exists.
- **Frontend**: `src/App.vue` orchestrates. `handleUpgrade` does `createList` → `addSavedList` (localStorage) → `setUlidMode` → `setupAutoSave`. Order matters and is discussed in section 8. `useApiClient.createAutoSaver` debounces 1s and only reacts to changes after it is installed; overlapping in-flight saves are not serialized.
- **Tests**: Vitest 4.0.17, no config file, Node environment, one pure-function suite `src/composables/useUrlState.test.ts`. No Miniflare, no workers pool. CI runs `npm run build` then `npm run test:run` on Node 20. `wrangler` is global, not a devDependency.
- **Wrangler**: default and `production` envs share the same D1 database (zero rows). `wrangler email sending list` reports no sending subdomain, so live email cannot work until Hermes provisions the domain.

## 2. Architecture decisions

1. **One persistence endpoint.** `POST /api/lists` becomes the single "persist an event" call, used by both the new header "Save event" button and the too-long-URL banner. Body gains `idempotencyKey`, `email`, `title` as siblings of `data`, never inside `data`. The old email-less upgrade flow is retired from the UI. The API requires all four fields.
2. **Email is a side effect after commit, never a precondition.** List row plus a `save_receipts` row are committed in one D1 batch. Only then is the email attempted. The response always carries the created list and an `email.status`.
3. **Idempotency by client-generated UUID v4.** Stored in a nullable unique column on `settlement_lists`. Replaying the same key returns the same list. Replays only re-attempt the email when the previous attempt definitively failed and an attempts cap has not been hit.
4. **Rate limit is a D1 sliding log with an atomic conditional insert.** D1 is a single-writer SQLite database, so one `INSERT ... SELECT ... WHERE count < 10` statement is the serialization point across all isolates and colos. No Durable Object, no Workers Rate Limiting binding (that one is per-colo and approximate).
5. **Client identity is `CF-Connecting-IP` only.** Cloudflare sets it at the edge and overwrites any client-supplied value. `X-Forwarded-For`, `X-Real-IP`, and `True-Client-IP` are ignored. The stored bucket key is a SHA-256 of the normalized IP (IPv6 reduced to its /64), never the raw address.
6. **The email address is never stored.** Not in `settlement_lists.data`, not in `save_receipts`, not in logs. Retries carry it again in the request body. The receipt only records status, attempts, and timestamps.
7. **Share link is built from a constant.** `PUBLIC_ORIGIN = 'https://grouppayback.com'` in code, plus the ULID after `isValidUlid`. `request.url` and the `Host` header are never consulted.
8. **Email transport is injected.** An `EmailSender` interface with a `BindingEmailSender` (wraps `env.EMAIL`) and a `MockEmailSender` (logs a redacted line, never sends). Mock is selected whenever `env.EMAIL` is absent or `EMAIL_MODE !== 'live'`. `wrangler dev` will always be mock.
9. **Generated types.** Run `wrangler types --env-interface Env` to produce `worker-configuration.d.ts`; switch `tsconfig.workers.json` to use it instead of the `@cloudflare/workers-types` ambient types (the two cannot coexist in one program without duplicate-global errors). Remove the explicit `import type { D1Database }` lines. Drop the now-unused package in the same PR.
10. **CORS is tightened for the API.** Allow origin `https://grouppayback.com` (plus `http://localhost:5173` in dev via a var). POST rejects requests whose `Origin` header is present and not allowed. This stops third-party pages from making visitors' browsers trigger saves and emails.

## 3. Touched paths

| Path | Change |
|---|---|
| `migrations/0000_initial.sql` | Baseline, identical to `schema.sql` (all `IF NOT EXISTS`) |
| `migrations/0001_save_event.sql` | New column, unique index, `save_receipts`, `rate_limit_events` |
| `schema.sql` | Keep as the human-readable "current full schema", updated to match |
| `wrangler.toml` | `migrations_dir`, `[vars]` (`EMAIL_MODE`, `ALLOWED_ORIGINS`), `[[send_email]]` binding on the live env only |
| `worker-configuration.d.ts` | Generated, committed |
| `tsconfig.workers.json` | Use generated types, exclude `workers/**/*.test.ts` |
| `tsconfig.node.json` | Add `vitest.config.ts` to `include` |
| `vitest.config.ts` | New: include `src/**` and `workers/**` tests, longer timeout for Miniflare suites |
| `package.json` | devDeps `miniflare` (pinned), `@types/node` already present; scripts `test:workers`, `email:preview`, `migrate:local` |
| `workers/index.ts` | `Env` from generated types, CORS allowlist, pass `ctx` for `waitUntil` pruning, body-size guard, route wiring |
| `workers/routes/lists.ts` | Rewrite `handleCreateList`; use `sanitizeAppState`; explicit response shape; 413/429 mapping |
| `workers/lib/validate.ts` | New: `validateEmail`, `validateTitle`, `validateIdempotencyKey`, `sanitizeAppState`, `escapeHtml` |
| `workers/lib/rateLimit.ts` | New: `consumeRateLimitToken`, `pruneRateLimitEvents`, `bucketKeyFromRequest` |
| `workers/lib/db.ts` | `createListIdempotent`, `getListByIdempotencyKey`, `claimEmailSend`, `settleEmailSend`, explicit column lists |
| `workers/lib/email.ts` | New: `PUBLIC_ORIGIN`, `buildShareUrl`, `buildSaveEmail` (subject/text/html), `EmailSender` interface + two implementations |
| `workers/lib/*.test.ts`, `workers/routes/lists.test.ts` | New test suites (section 10) |
| `src/types/index.ts` | `ApiCreateListRequest`, `ApiCreateListResponse` (with `email.status`), `ApiErrorResponse.retryAfterSeconds` |
| `src/composables/useApiClient.ts` | `createList` takes the new body, maps 429 to `RateLimitedError`; `createAutoSaver` returns `{ stop, saveNow }` and serializes in-flight saves |
| `src/composables/useSaveEvent.ts` | New: save state machine (section 8) |
| `src/composables/useSaveEvent.test.ts` | New |
| `src/components/SaveEventModal.vue` | New (replaces `UpgradeModal.vue`) |
| `src/components/UpgradeModal.vue` | Removed |
| `src/components/UpgradeButton.vue` | Relabel "Save event", cloud icon, same variants |
| `src/App.vue` | Header button always visible in URL mode, banner rewired, `handleUpgrade` replaced by `useSaveEvent` wiring |
| `docs/mockups/save-event-modal.html`, `docs/mockups/email-preview.html` | Static previews for approval |
| `scripts/email-preview.ts` | Renders `buildSaveEmail` to the preview file |
| `README.md`, `CLAUDE.md` (local only, gitignored) | Document the flow, migrations, and email mock mode |

## 4. Schema migration

`migrations/0001_save_event.sql` (additive only, safe under the currently deployed worker):

```sql
ALTER TABLE settlement_lists ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_lists_idempotency_key
  ON settlement_lists(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS save_receipts (
  list_id        TEXT PRIMARY KEY REFERENCES settlement_lists(id),
  email_status   TEXT NOT NULL CHECK (email_status IN ('pending','sending','sent','failed')),
  email_attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at     INTEGER,
  sent_at        INTEGER,
  last_error     TEXT,                 -- short, sanitized code only, never an address
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket TEXT NOT NULL,                -- sha256(normalized ip)
  ts     INTEGER NOT NULL              -- ms epoch
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_bucket_ts ON rate_limit_events(bucket, ts);
```

Adopt Wrangler's migration tracking: set `migrations_dir = "migrations"` in `wrangler.toml`, apply locally with `wrangler d1 migrations apply grouppayback --local`. The baseline `0000` is idempotent, so applying it against the already-created production table is a no-op. Remote application is a gated step (section 12). No email address, title copy, or IP is written to any table. `getList` switches from `SELECT *` to an explicit column list so `idempotency_key` never reaches a response.

## 5. Request contract

`POST /api/lists`

```json
{ "idempotencyKey": "uuid-v4", "email": "a@b.com", "title": "Ski trip", "data": { "people": [] } }
```

| Status | Meaning |
|---|---|
| 201 | Created. Body: `{ id, data, version, createdAt, updatedAt, email: { status } }` |
| 200 | Idempotent replay of an existing key. Same body shape. Client must not overwrite local state with `data`. |
| 400 | `code` in `INVALID_JSON`, `INVALID_DATA`, `INVALID_EMAIL`, `INVALID_TITLE`, `INVALID_IDEMPOTENCY_KEY` |
| 403 | `code: 'ORIGIN_NOT_ALLOWED'` |
| 413 | `code: 'PAYLOAD_TOO_LARGE'` (body over 256 KB, checked via `Content-Length` and a bounded read) |
| 429 | `code: 'RATE_LIMITED'`, `retryAfterSeconds`, plus `Retry-After` header |

`email.status` is one of `sent`, `failed`, `pending` (another request holds the send claim), `mocked` (non-live environment). GET and PUT contracts are unchanged except that PUT now stores the sanitized state.

Handler order in `handleCreateList`:

1. Origin check, size check, JSON parse.
2. Validate `idempotencyKey`, `email`, `title`; `sanitizeAppState(data)` rebuilds a whitelisted object (people, items, payments, currency, eventName) and drops anything else. Set `eventName` on the sanitized state to the validated title so stored data and email agree.
3. Look up by idempotency key. If found and the receipt is `sent`, return 200 immediately without consuming a rate token or sending.
4. `consumeRateLimitToken(bucket)`. On refusal return 429.
5. If not found: `db.batch([INSERT settlement_lists (with key), INSERT save_receipts pending])`. On `UNIQUE constraint failed` (a concurrent twin won), re-read by key and continue.
6. `claimEmailSend(listId)`: one conditional UPDATE (section 7). If it claims, send via `EmailSender`, then `settleEmailSend(listId, 'sent' | 'failed', code)`. If it does not claim, report the current status.
7. Respond. `ctx.waitUntil(pruneRateLimitEvents(now))` runs on roughly one in twenty requests.

## 6. Rate limiting design (10 per IP in any 5-minute window)

Bucket key: `sha256(normalize(CF-Connecting-IP))`, IPv4 as-is, IPv6 truncated to the first 64 bits. If the header is missing (only happens outside Cloudflare), the bucket is the literal `'no-ip'` so local dev still works but shares one bucket.

Atomic consume, one statement, no read-then-write gap:

```sql
INSERT INTO rate_limit_events (bucket, ts)
SELECT ?1, ?2
WHERE (SELECT COUNT(*) FROM rate_limit_events
       WHERE bucket = ?1 AND ts > ?2 - 300000) < 10
```

`meta.changes === 1` means allowed, `0` means limited. SQLite executes the subquery and insert under one write lock, and D1 serializes all writers, so concurrent isolates cannot both observe 9 and both insert. Retry-After is computed by reading the oldest timestamp in the window: `ceil((oldest + 300000 - now) / 1000)`.

Tokens are consumed only when a create or an email attempt will actually happen (after validation, after the "already sent" short-circuit). Bad payloads and pure replays are free, but every email attempt costs a token, which bounds retry-driven email volume to 10 per IP per 5 minutes on top of the per-event cap of 3 attempts. Pruning deletes rows older than 300 seconds. Do not use D1 sessions or read replicas for these queries; all go to the primary.

## 7. Idempotency and duplicate-email control

- **Duplicate events**: impossible under a given key because of the partial unique index. Concurrent twins are resolved by catching the unique violation (D1 surfaces it as an `Error` whose message contains `UNIQUE constraint failed`; a small `isUniqueViolation` helper matches that) and re-reading.
- **Duplicate emails**: the receipt is a small state machine. Claiming is an atomic UPDATE:

```sql
UPDATE save_receipts
SET email_status = 'sending', claimed_at = ?now, email_attempts = email_attempts + 1, updated_at = ?now
WHERE list_id = ?
  AND email_attempts < 3
  AND (email_status IN ('pending','failed')
       OR (email_status = 'sending' AND claimed_at < ?now - 120000))
```

Only the request whose UPDATE reports one change may call `send`. After `send` resolves, set `sent` and `sent_at`; on throw, set `failed` and a short sanitized `last_error` code. A stale `sending` claim older than two minutes is treated as a crashed attempt and may be retried once more. This accepts a small chance of a second email if an isolate dies between a successful send and the status write, in exchange for never silently losing the email. This trade is deliberate and documented in code.

- **Client key lifetime**: generated with `crypto.randomUUID()` when the modal opens, kept in component memory for the whole modal session including retries, discarded after a success. A page reload starts a fresh key. That could create a second list if the user reloads mid-request and saves again, which is a new user intent and acceptable.
- **No public resend endpoint.** The only way to re-trigger an email is to replay the original POST with the same secret key, same body, from the same modal session, subject to the attempts cap and the rate limit. There is no route keyed by ULID that sends mail.

## 8. Frontend state machine and privacy boundary

New composable `useSaveEvent.ts`, pure enough to unit test with an injected `createList` function and injected callbacks:

```
idle → submitting → savedEmailSent
                  → savedEmailFailed   (event saved, email failed or pending; offers bounded "Try email again")
                  → errorNetwork       (fetch threw; same key, "Retry")
                  → errorRateLimited   (429; shows minutes from Retry-After; Retry disabled until then)
                  → errorValidation    (400; inline messages)
```

Invariants enforced by the composable and covered by tests:

1. **Snapshot then flush.** The request carries a deep-cloned snapshot and its JSON string. On success the composable calls `setUlidMode(id, version)` first, then compares the current `JSON.stringify(state)` with the snapshot string. If they differ, it calls the auto-saver's new `saveNow()` so edits made during the request reach the server immediately instead of waiting for the next keystroke.
2. **Replay does not clobber local edits.** On a 200 replay the client uses only `id` and `version`, never `data`, then flushes as above.
3. **Mode switch before localStorage.** `setUlidMode` (URL becomes `?u=`) happens before `addSavedList`. `addSavedList` already swallows quota errors, and the composable also wraps it in try/catch so a throwing storage layer can neither block the mode switch nor leave the app in URL mode with a server-side list, which is what would create duplicates on the next save.
4. **Stale responses are ignored.** A request sequence number is captured at submit. If `reset()` ran or `listId` was set by another path before the response arrives, the response is discarded and the modal closes quietly. The list exists server-side and the email may have gone out with a valid link, which is correct.
5. **Serialized auto-save.** `createAutoSaver` gets an in-flight guard: if a save is running, mark dirty and run again when it finishes, always with the latest `listVersion`. This closes the existing window where a slow PUT followed by a debounced second PUT with a stale version produced a spurious "Someone else edited this list" message. It is adjacent but required for invariant 1 to hold.
6. **Privacy boundary.** The email lives only in `SaveEventModal.vue` local state and in the in-flight request body. It is never passed to `useUrlState`, `useUpgradeState`, `encodeState`, or `history.replaceState`. Tests assert that after a simulated save, `JSON.stringify(state)`, `encodeState(state)`, and the saved-lists localStorage payload contain no `@`-bearing email string. Worker tests assert that a malicious `data.email` is stripped by `sanitizeAppState`, that GET never returns receipt columns, and that `console.error` output in the worker never includes the request body (the catch in `workers/index.ts` logs only `error.message`).

UI wiring in `App.vue`: "Save event" button in the header whenever `!isUlidMode`, regardless of URL length; the amber banner keeps its copy but its button opens the same modal. In ULID mode the header shows the existing "Auto-saved to cloud" hint. The title field writes to `setEventName` on successful save so the event name in the app matches the emailed title.

## 9. Email content and validation rules

Validation (server, in `workers/lib/validate.ts`, mirrored loosely on the client for fast feedback):

| Field | Rule |
|---|---|
| email | trim, total length ≤ 254, local part ≤ 64, HTML5 address pattern plus at least one dot in the domain, no whitespace, no control chars, no `<>"(),;:` |
| title | string, trim, 1 to 100 chars, reject any code point in `\u0000-\u001F`, `\u007F-\u009F`, `\u2028`, `\u2029` |
| idempotencyKey | lowercase UUID v4 pattern |
| data | `sanitizeAppState` whitelist rebuild; names and item names capped at 200 chars, `amountCents` must be a safe non-negative integer |

`buildSaveEmail({ title, shareUrl })` is pure and returns `{ subject, text, html }`. Subject: `Your GroupPayback link for "<title>"`, title truncated to 60 chars with an ellipsis for the subject only. The HTML body escapes `& < > " '`. User input never reaches `from`, `replyTo`, `cc`, `bcc`, or custom `headers`; `to` is the bare validated address, no display name. `from` is the constant `GroupPayback <no-reply@grouppayback.com>`.

Design direction (for approval, not implemented yet): 560px single column, system font stack, white card on a `#f6f7f9` background, small "GroupPayback" wordmark, heading "Your event is saved", the event title as a quiet gray label, one blue table-based button "Open your event", the plain URL under it for copy-paste, a line "Anyone with this link can view and edit the event", and a footer: "You're getting this one-time email because you saved an event on grouppayback.com. It's just a record of your link. No newsletters, no account, nothing to verify." No images, no tracking, inline CSS only. The text version mirrors the same structure.

Preview approach: `npm run email:preview` renders the real builder output to `docs/mockups/email-preview.html`, and a static Tailwind-CDN mockup `docs/mockups/save-event-modal.html` shows the modal's idle, saving, success, email-failed, and rate-limited states. Hermes attaches screenshots of both to the PR before any Vue component is written. Once approved, the real component is exposed behind `import.meta.env.DEV` and `?preview=save-event` for a second look before merge.

## 10. Tests and commands

Worker tests run against a real local D1 by creating a `Miniflare` instance in `beforeAll` with `d1Databases: { DB: 'test' }`, applying the two migration files, and calling `mf.getD1Database('DB')`. This is a Node-side Vitest test talking to workerd's SQLite, which is the same engine and locking model as production D1. Adding `miniflare` as a pinned devDependency is the only new dependency. (`@cloudflare/vitest-pool-workers` was considered; it requires `wrangler` as a peer and its Vitest 4 support must be verified, so it is not the first choice.)

RED/GREEN slices, each one landing tests first:

1. `workers/lib/validate.test.ts`: every rule above, including CRLF and Unicode separator rejection, HTML escaping, `sanitizeAppState` dropping `email`/unknown keys.
2. `workers/lib/email.test.ts`: link is exactly `https://grouppayback.com/?u=<ULID>` even when a fake request has a hostile Host; title escaped in HTML but raw in text; subject truncation; snapshot of HTML and text.
3. `workers/lib/rateLimit.test.ts` (Miniflare D1): 10 allowed then 11th refused; 30 concurrent `Promise.all` calls yield exactly 10 successes; after advancing the injected clock past the oldest event exactly one more is allowed; buckets are independent; prune removes only expired rows; Retry-After arithmetic.
4. `workers/lib/db.test.ts` (Miniflare D1): same key twice returns the same id; 10 concurrent creates with one key produce one row; claim UPDATE grants exactly one of N concurrent claimers; `failed` can be reclaimed, `sent` cannot, attempts cap at 3, stale `sending` reclaimable after 120s.
5. `workers/routes/lists.test.ts` (Miniflare D1 plus a recording fake `EmailSender`): 201 with `sent`; sender throws → 201 with `failed` and row present; replay after `sent` → 200 and zero new sends; replay after `failed` → one new send; 429 with header; ignores `X-Forwarded-For`; rejects bad Origin; 413 on oversize; GET response has no receipt or key fields; stored data has no email.
6. `src/composables/useSaveEvent.test.ts`: key reuse across retries and regeneration after success; `setUlidMode` called before `addSavedList`; a throwing `addSavedList` still ends in a saved state; edits during flight trigger `saveNow` with the latest state; replay ignores `data`; stale response after reset is dropped; no email in `state` or `encodeState` output.
7. `src/composables/useApiClient.test.ts`: 429 maps to `RateLimitedError` with seconds; auto-saver serializes overlapping saves and uses the newest version.

Commands (all local, no remote effects):

```bash
npm install                                            # adds miniflare
wrangler types --env-interface Env                     # regenerate worker-configuration.d.ts
wrangler d1 migrations apply grouppayback --local      # local schema
npm run typecheck:app && npm run typecheck:workers
npm run test:run                                       # app + worker suites
npm run build                                          # what CI runs
npm run email:preview                                  # regenerates docs/mockups/email-preview.html
wrangler deploy --dry-run --outdir .wrangler/dry-run   # config validation, uploads nothing
npm audit && npm audit --omit=dev                      # report only
```

`npm audit` is assessed in the PR description. Only advisories touching runtime dependencies or the newly added `miniflare` tree get fixed; nothing else is upgraded.

## 11. Email delivery uncertainty

- The account has no sending subdomain. Until Hermes inspects DNS and provisions one with Wrangler, live sending is impossible and `EMAIL_MODE` stays `mock` everywhere. The feature still persists events and shows the "copy your link now" fallback, so it can ship independently of email readiness if Nathan chooses.
- The Email Service is in beta on Workers Paid. If the binding rejects at deploy time or `send` throws at runtime, receipts record `failed` and users see the fallback. A `wrangler.toml` var flip back to `mock` is the kill switch and needs only a redeploy.
- `send` resolving means accepted by Cloudflare, not delivered. Bounces are invisible to us, so UI copy says "We sent the link to …" rather than "delivered".
- Verify before implementation: whether `compatibility_date = "2025-01-01"` is sufficient for the builder-style `send` call, and whether `wrangler dev` needs the binding omitted or tolerates it in local mode. Plan assumes the binding is present only in the live env and absent locally.

## 12. Deployment gates and rollback

Gates, in order, each requiring an explicit go from Nathan:

1. **Mockup approval**: static modal mockup and email preview screenshots.
2. **Implementation review**: UI pre-commit review, then PR review by Hermes. Reviews block only on in-scope correctness or security, or on a critical immediate out-of-scope risk.
3. **Email domain**: Hermes provisions the sending domain via Wrangler after DNS inspection, and `wrangler email sending list` shows it verified. A single test send to Nathan's own address from a preview deployment is the only acceptable live-mail check, and only with approval.
4. **Deploy**.

Deploy sequence (only after gate 4):

```bash
wrangler d1 migrations apply grouppayback --remote     # additive, old worker keeps working
npm run build && wrangler deploy                       # or deploy:prod, whichever env is live
```

Then smoke: GET an existing list, one save with Nathan's own email, confirm 201 and the email, confirm the share link opens the event. Confirm which env is actually serving grouppayback.com before deploying, since both envs point at the same database and only one should carry `EMAIL_MODE = "live"`.

Rollback: `wrangler rollback` to the previous version, or redeploy the prior commit. The migration is additive and nullable, so no down migration is needed and the old worker runs unchanged on the new schema. If only email misbehaves, flip `EMAIL_MODE` to `mock` and redeploy; persistence keeps working. If rate limiting misfires, the same var mechanism can raise the limit without a schema change.

## 13. Risks and explicit assumptions

- Assumption: the modal replaces the email-less upgrade path entirely. If Nathan wants to keep an email-optional save, the server can make `email`/`title` optional with no other design change.
- Assumption: rate limiting applies to creates and email attempts, not to PUT auto-saves, which would otherwise break editing within seconds.
- Adjacent risks surfaced but not fully in scope: `isValidAppState` has no size bounds on PUT today (the plan adds the 256 KB guard to both POST and PUT since it is one line in the router), and CORS `*` currently allows cross-site writes (tightened in this plan).
- Out of scope, noted for later: Turnstile or similar on the save endpoint if email abuse appears despite the IP limit, and splitting the shared D1 database between envs.
