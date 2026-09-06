ALTER TABLE settlement_lists ADD COLUMN idempotency_key TEXT;
ALTER TABLE settlement_lists ADD COLUMN request_hash TEXT;
CREATE UNIQUE INDEX idx_settlement_lists_idempotency_key ON settlement_lists(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE save_receipts (
 list_id TEXT PRIMARY KEY REFERENCES settlement_lists(id),
 email_status TEXT NOT NULL CHECK (email_status IN ('pending','sending','sent','failed')),
 email_attempts INTEGER NOT NULL DEFAULT 0,
 claim_token TEXT,
 updated_at INTEGER NOT NULL
);
CREATE TABLE rate_limit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, bucket TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE INDEX idx_rate_limit_events_bucket_ts ON rate_limit_events(bucket, ts);
