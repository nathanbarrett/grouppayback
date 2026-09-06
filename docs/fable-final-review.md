# Final Claude Fable 5.1 high review

## Verdict: PASS, with release gates

No in-scope correctness or security defect that warrants a block. The persistence, idempotency, claim, CORS, body-size, validation, and privacy paths hold up under the failure scenarios I traced. Two Medium items in the rate limiter should be fixed before `EMAIL_MODE` ever becomes `live`, and one deployment fact must be confirmed before deploy. Production `EMAIL_MODE = "mock"` is a **RELEASE GATE**, not a defect, and the mock result must not be read as delivery success.

I did not run anything. I relied on the reported 45 passing tests, typechecks, build, diff check, and the QA screenshots in `/tmp/grouppayback-mobile-qa/`, which I inspected and which match the stated geometry. No remote Cloudflare state was touched or read.

### Findings

**M1. IPv6 rate-limit bucket is per full address, so any IPv6 client can bypass the limit** at `workers/lib/rateLimit.ts:9`. The key is a hash of the normalized address, not the /64 prefix the design called for. Residential IPv6 assigns a whole /64, so a single attacker can rotate addresses per request and get unlimited POSTs. Failure scenario once live: unlimited outbound mail from `no-reply@grouppayback.com` to arbitrary recipients with an attacker-chosen 100-character title, which is a spam and phishing relay and a sender-reputation risk. Today, in mock mode, the same bypass allows unbounded list creation at up to 256 KB each. Master had no limit at all, so this is still an improvement, which is why it is not a block. Classification: in-scope, Medium, required before live email.

**M2. Rate-limit rows are never pruned.** `pruneRateLimitEvents` at `workers/lib/rateLimit.ts:20` has no caller, and the fetch handler at `workers/index.ts:8` does not take the execution context. Every allowed POST adds a row forever. Combined with M1 this is a D1 storage-exhaustion vector that would fail all cloud saves. Alone it is slow growth plus indefinite retention of hashed IPv4 addresses, which are trivially reversible from a SHA-256 over a 32-bit space. Classification: in-scope, Medium, fix before or shortly after release.

**M3. Origin allowlist assumes the site is served from the apex host.** `workers/index.ts:12` allows only `PUBLIC_ORIGIN` plus the env list, and `workers/index.ts:20` returns 403 to any other Origin before routing. Production sets `ALLOWED_ORIGINS = ""`. If any traffic reaches the app via `www.grouppayback.com` or a `workers.dev` URL, both the new save and the existing PUT auto-save for cloud lists will fail, and the client shows the generic "couldn't confirm the save" text because 403 falls through to the else branch at `src/composables/useSaveEvent.ts:88`. Classification: release gate, Medium. Confirm the serving hostnames before deploy.

**L1. Mock-mode production UX.** With `EMAIL_MODE = "mock"`, `workers/lib/save.ts:27` records `failed`, so every user who saves is asked for an email and then told "Your email was not sent", and `src/components/SaveEventModal.vue:89` offers "Try email again", which can never succeed and consumes a rate token per click. The header button at `src/App.vue:260` shows this flow to all URL-mode users. The desktop-saved screenshot confirms the retry button appears. This is the intentional gate. The `mocked` status exists in `src/types/index.ts:56` and would suppress the retry button, but the server never returns it. Optional: return `mocked` when not live so the retry button hides.

**L2. Email copy deviates from the approved mock.** The approved preview at `docs/mockups/email-preview.html:24` says "No newsletters, no account, nothing to verify." The implementation at `workers/lib/email.ts:25` and the HTML body drop "No newsletters", and `workers/lib/email.test.ts:10` asserts the word is absent. The modal keeps the full phrase. Nathan should confirm this is wanted. Classification: in-scope, Low.

**L3. Provider throw becomes a permanent, unretryable "pending".** `workers/lib/save.ts:30` maps any `send` exception to `sending`, which is reported as `pending` and never reclaimed. Deliberate and safe against duplicate mail, but it also swallows definitive pre-send failures such as a rejected sender address or an unsupported builder overload. Nothing is logged in that catch. During the approved live test, a misconfigured binding would look like a silent "couldn't confirm" with no retry and no server-side signal. Optional: log a constant plus `error.name` only, and treat a synchronous TypeError as `failed`.

**L4. PUT now enforces limits the UI does not.** `workers/lib/validate.ts:36`, `:39`, `:54`, and `:55` cap people, items, currency, and event name, and `workers/routes/lists.ts:64` applies them to auto-save. The event-name input at `src/App.vue:344` and the person and item inputs have no `maxlength`. A cloud list whose event name exceeds 100 characters, or a name over 200, gets a 400 on every edit, surfaced as the raw "Invalid request" string via `src/composables/useApiClient.ts:81`. Rare, but silent for the user. Optional: add matching `maxlength` attributes or friendlier copy.

**L5. Stored hash is a fast hash of the recipient.** `workers/lib/save.ts:12` hashes key, email, title, and data with SHA-256 and stores it at `:16` beside the key. Anyone with the database can dictionary-attack common addresses since the salt is stored alongside. "Email is never stored" is true in letter but slightly weaker in spirit. Optional: HMAC with a server secret, or accept and document.

**L6. Two deploy commands target one Worker with different bindings.** `wrangler.toml:24` names the production env the same as the default. Running plain `npm run deploy` after `deploy:prod` would remove the EMAIL binding and set localhost origins on production. Documented in the preflight doc. Optional: guard the default script.

**L7. Docs and schema drift.** `schema.sql:11` onward omits `IF NOT EXISTS`, so the manual command in the local notes would now fail on re-run. `README.md` still says no backend and Cloudflare Pages. `docs/email-preflight.md` embeds machine-local screenshot paths and reviewer-process notes. Optional cleanup.

### Release gates and what I verified

Residual gates, in order:

1. **EMAIL_MODE stays `mock`** until sender onboarding and one approved live send to Nathan's own address. Treat M1 and L3 as conditions of that approval.
2. **Confirm serving hostnames** for M3, and confirm which Worker owns the custom domain.
3. **Apply remote migrations before deploying** the new Worker. Both files are additive and the old Worker tolerates the new columns since `createList` in `workers/lib/db.ts:80` names its columns explicitly.
4. **Runtime support for the builder-style `send`** under `compatibility_date = "2025-01-01"` is unverified. The live test covers it, but see L3 for why a failure would be quiet.
5. **PR review before production** remains mandatory.

What held up under review:

- **Idempotency and concurrency.** The batch at `workers/lib/save.ts:15` is atomic, the conflict target matches the partial unique index, the hash check at `:20` rejects reuse with different content, and the claim at `:22` is a single conditional UPDATE. Replays after `sent` never resend. The 10-way concurrent test covers the twin race.
- **Rate limiter atomicity.** The conditional INSERT at `workers/lib/rateLimit.ts:14` has no read-then-write gap, and the 30-way concurrent test proves exactly ten succeed.
- **CSRF and CORS.** The Origin check runs before routing and before the rate limiter, so a cross-site form POST cannot consume quota or create lists.
- **Body limits.** `workers/routes/lists.ts:11` bounds both header and stream for POST and PUT.
- **Header injection.** Email and title reject control characters, so the subject and recipient cannot carry CRLF. The HTML escapes the title, and the link is built from a validated ULID and a constant origin.
- **Privacy.** GET uses an explicit column list at `workers/lib/db.ts:109`. The recipient exists only in the modal ref and the in-memory request. The 500 path logs a constant. Tests assert no address in state, response, or storage.
- **Client state machine.** Stale responses after reset are dropped, the request stays immutable across retries, `setUlidMode` precedes `addSavedList`, in-flight edits flush through `saveNow`, and 429 disables submit until the server deadline.
- **Auto-saver.** `src/composables/useApiClient.ts:106` serializes overlapping saves and always sends the latest version.
- **Mobile header fix.** `src/App.vue:244`, `:249`, and `:250` only change layout classes. The QA JSON shows every header and dialog right edge at or below 374 px at 390 px width, and the desktop layout is unchanged. The modal styling is untouched.

Optional test follow-ups: an Origin 403 case, a `send` throw asserting `pending` with no reclaim, the three-attempt cap, a 413 on PUT, and an IPv6 same-/64 bucket case once M1 is fixed.
