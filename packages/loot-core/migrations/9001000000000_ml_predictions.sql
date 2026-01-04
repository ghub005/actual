BEGIN TRANSACTION;

-- ML Predictions table: stores what the ML model predicted for each transaction
CREATE TABLE ml_predictions
  (id TEXT PRIMARY KEY,
   transaction_id TEXT NOT NULL,
   predicted_category_id TEXT NOT NULL,
   confidence REAL NOT NULL,
   model TEXT,
   reasoning TEXT,
   tokens_used INTEGER,
   created_at TEXT DEFAULT (datetime('now')),
   FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE);

CREATE INDEX idx_ml_predictions_txn ON ml_predictions(transaction_id);
CREATE INDEX idx_ml_predictions_created ON ml_predictions(created_at);

COMMIT;
