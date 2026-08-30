CREATE TABLE IF NOT EXISTS advisor_daily_usage (
  actor_id TEXT NOT NULL,
  usage_date TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (actor_id, usage_date)
);