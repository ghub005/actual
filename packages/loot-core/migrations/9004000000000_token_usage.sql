BEGIN TRANSACTION;

-- Token Usage table: tracks LLM API token consumption for cost monitoring
CREATE TABLE token_usage
  (id TEXT PRIMARY KEY,
   date TEXT NOT NULL,
   feature TEXT NOT NULL,
   input_tokens INTEGER DEFAULT 0,
   output_tokens INTEGER DEFAULT 0,
   request_count INTEGER DEFAULT 0,
   UNIQUE(date, feature));

CREATE INDEX idx_token_usage_date ON token_usage(date);

COMMIT;
