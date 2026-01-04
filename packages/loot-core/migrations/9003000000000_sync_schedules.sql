BEGIN TRANSACTION;

-- Sync Schedules table: stores automatic bank sync schedules per account
CREATE TABLE sync_schedules
  (id TEXT PRIMARY KEY,
   account_id TEXT NOT NULL UNIQUE,
   cron_expression TEXT DEFAULT '0 6,18 * * *',
   last_sync TEXT,
   next_sync TEXT,
   enabled INTEGER DEFAULT 1,
   retry_count INTEGER DEFAULT 0,
   last_error TEXT,
   created_at TEXT DEFAULT (datetime('now')),
   FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE);

CREATE INDEX idx_sync_schedules_account ON sync_schedules(account_id);
CREATE INDEX idx_sync_schedules_enabled ON sync_schedules(enabled);

COMMIT;
