
-- MAJY Academy authentication and cloud progress.
-- Does not modify existing lesson or quiz records.

CREATE TABLE IF NOT EXISTS academy_users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0
    CHECK (email_verified IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS academy_email_tokens (
  token_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_type TEXT NOT NULL
    CHECK (token_type IN ('verify_email', 'reset_password')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES academy_users(user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_email_tokens_user
ON academy_email_tokens(user_id, token_type);

CREATE TABLE IF NOT EXISTS academy_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT,
  FOREIGN KEY (user_id) REFERENCES academy_users(user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_academy_sessions_user
ON academy_sessions(user_id);

CREATE TABLE IF NOT EXISTS academy_user_progress (
  user_id TEXT NOT NULL,
  day_number INTEGER NOT NULL
    CHECK (day_number BETWEEN 1 AND 7),
  completed INTEGER NOT NULL DEFAULT 0
    CHECK (completed IN (0, 1)),
  score INTEGER,
  total INTEGER,
  percentage INTEGER,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, day_number),
  FOREIGN KEY (user_id) REFERENCES academy_users(user_id)
    ON DELETE CASCADE
);
