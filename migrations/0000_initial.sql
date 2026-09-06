CREATE TABLE IF NOT EXISTS settlement_lists (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 version INTEGER DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_settlement_lists_created_at ON settlement_lists(created_at);
