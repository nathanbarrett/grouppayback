# Save-event email preflight

> Production release approved on 2026-09-06, superseding the historical gates below. Root-domain Email Sending is enabled for `no-reply@grouppayback.com`; SPF, DKIM, DMARC and bounce MX resolve. Production uses `EMAIL_MODE = "live"`; local/default stays mock. Migrations 0000–0002 are applied remotely. The existing apex custom domain and exact `grouppayback.nathan-barrett.workers.dev` serving hostname were verified. No live test email was sent: recipient consent and inbox delivery verification remain outstanding.

## Wiring and safe defaults

- Default/local config has `EMAIL_MODE = "mock"` and **no** email binding. Persistence succeeds, but email truthfully reports `failed` and offers the copy-link fallback; no simulated delivery is reported as sent.
- `production` explicitly targets the existing `grouppayback` Worker. Read-only Wrangler deployment discovery found existing deployments there and no `grouppayback-production` Worker. Both configs use the existing D1 database. Confirm custom-domain attachment before release.
- Production has an `EMAIL` send binding restricted to `no-reply@grouppayback.com`, with `remote = false` (never copy the getting-started docs' `remote = true` example into local config). `EMAIL_MODE` remains `mock` until sender onboarding and an explicitly approved live-email check.
- `ASSETS` is explicitly bound because the Worker calls `env.ASSETS.fetch`. Both D1 configs set `migrations_dir = "migrations"`.
- Deploy with `npm run deploy:prod` after approval. Default `npm run deploy` now exits with an error before Wrangler; plain `wrangler deploy` is unsafe because it can overwrite production with local/mock settings.
- Kill switch: production `EMAIL_MODE = "mock"`, followed by an approved redeploy. Missing binding or any non-`live` mode also fails closed.

## Read-only readiness result

Wrangler 4.103.0 reported **No sending subdomains found in this account**. `wrangler email sending settings grouppayback.com` reported **No sending subdomain found**. No enable, DNS update, remote migration, mail send, upload, or deploy was performed.

## Remaining gates

1. Historical Fable review and focused Opus fix review are recorded. Final exact-head PR review remains required; see `opus-fix-review.md` for recovery provenance and limitations.
2. Confirm which Worker owns the custom domain. Onboard `grouppayback.com` only after approval and DNS inspection; check Workers Paid eligibility, SPF, DKIM, DMARC and Cloudflare bounce-domain records. Preserve existing mail routing/DNS.
3. Read back sending settings/DNS readiness. Approve one live test to Nathan's own confirmed address before changing production `EMAIL_MODE` to `live`. The binding's builder API resolves on acceptance, not proof of inbox delivery.
4. Approve remote additive migrations and deployment. Apply migrations before deploying the new API/UI. Smoke-test save, replay, existing-list GET/PUT and real receipt delivery. Keep prior Worker version for rollback; additive schema can remain.

## Local verification and remaining visual issue

- Both migrations applied successfully to local D1 only. Default and production `wrangler deploy --dry-run` passed; production exposes EMAIL/DB/ASSETS with mock mode, default has no EMAIL binding.
- 45 tests passed; build (including app/node/Worker typechecks) passed; `git diff --check` passed.
- Real local browser save persisted `Local preflight`, changed URL to `?u=`, and showed **Your email was not sent** with copy-link fallback. Read-back GET contained the event and no recipient or receipt metadata.
- Desktop modal was visually inspected at 1280×900 and follows the approved reference's typography, spacing, privacy copy and blue action treatment. Static reference source was inspected; rendering its file URL timed out, so pixel-level comparison was not completed.
- **Mobile QA resolved:** header now stacks below `sm`, bounds the action column and wraps buttons. Real Chromium 390×844 checks passed at exactly 390px document/inner width for idle, save form, saved result, saved idle and an existing-lists/new-event state. Header Copy Link right edge and both modal right edges are 374px (16px inset). Desktop form and saved-result checks passed at 1280×900; modal is 480px wide. Only header classes changed; approved modal styling is unchanged.
- Local-only browser artifacts and reviewer process paths are intentionally omitted from the repository. They are historical observations, not reproducible CI evidence.
- Current recovery verification: 51 tests across 9 files pass, app/Worker typechecks pass, build passes, and `git diff --check` passes. The recovered focused Opus report is in `opus-fix-review.md`; its source-baseline limitation means final exact-head PR review remains open.

## Current official references consulted

- https://developers.cloudflare.com/email-service/api/send-emails/workers-api/ — structured builder uses `{ from: { email, name }, to, subject, html, text }`; matches implementation.
- https://developers.cloudflare.com/email-service/configuration/send-bindings/ — `allowed_sender_addresses` restriction.
- https://developers.cloudflare.com/email-service/get-started/send-emails/ — onboarding/DNS and remote development warning.

The earlier technical plan is historical: implementation intentionally does not reclaim ambiguous `sending` receipts (avoids duplicate mail), consumes rate quota for every POST, and retains handwritten Worker types. Do not treat its proposed commands or email retry semantics as current implementation documentation.
