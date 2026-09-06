CREATE TABLE IF NOT EXISTS settlement_lists (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 version INTEGER DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 idempotency_key TEXT,
 request_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_settlement_lists_created_at ON settlement_lists(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_lists_idempotency_key ON settlement_lists(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS save_receipts (
 list_id TEXT PRIMARY KEY REFERENCES settlement_lists(id),
 email_status TEXT NOT NULL CHECK (email_status IN ('pending','sending','sent','failed')),
 email_attempts INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_bucket_ts ON rate_limit_events(bucket, ts);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ts ON rate_limit_events(ts);
