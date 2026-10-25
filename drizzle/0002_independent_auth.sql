CREATE TABLE auth_sessions (
 token_hash TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('guest','github','api')),
 display_name TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id,kind);
CREATE INDEX auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE auth_oauth_states (
 state_hash TEXT PRIMARY KEY NOT NULL,
 verifier TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
