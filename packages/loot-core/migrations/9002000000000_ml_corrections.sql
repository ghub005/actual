BEGIN TRANSACTION;

-- ML Corrections table: stores user corrections to ML predictions for learning
CREATE TABLE ml_corrections
  (id TEXT PRIMARY KEY,
   transaction_id TEXT NOT NULL,
   original_payee TEXT,
   amount INTEGER,
   predicted_category_id TEXT NOT NULL,
   predicted_category_name TEXT,
   actual_category_id TEXT NOT NULL,
   actual_category_name TEXT,
   created_at TEXT DEFAULT (datetime('now')),
   FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE);

CREATE INDEX idx_ml_corrections_created ON ml_corrections(created_at);
CREATE INDEX idx_ml_corrections_payee ON ml_corrections(original_payee);

COMMIT;
