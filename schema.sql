-- GroupPayback D1 Database Schema
-- Stores settlement lists that have been upgraded from URL storage

CREATE TABLE IF NOT EXISTS settlement_lists (
  id TEXT PRIMARY KEY,              -- ULID (26 chars, sortable by creation time)
  data TEXT NOT NULL,               -- JSON blob containing full AppState
  version INTEGER DEFAULT 1,        -- For optimistic locking/conflict resolution
  created_at INTEGER NOT NULL,      -- Unix timestamp in milliseconds
  updated_at INTEGER NOT NULL       -- Unix timestamp in milliseconds
);

-- Index for sorting by creation time (useful for future list management)
CREATE INDEX IF NOT EXISTS idx_settlement_lists_created_at ON settlement_lists(created_at);

-- Future: Stripe integration columns (commented out for now)
-- ALTER TABLE settlement_lists ADD COLUMN stripe_customer_id TEXT;
-- ALTER TABLE settlement_lists ADD COLUMN stripe_subscription_id TEXT;
