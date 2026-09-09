CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id TEXT NOT NULL,
  name TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_comments_entry ON comments (entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments (approved);
