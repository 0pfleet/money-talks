/**
 * Session persistence — SQLite-backed conversation storage.
 *
 * Schema:
 *   sessions(id, title, created_at, updated_at)
 *   messages(id, session_id, role, content, metadata, created_at)
 *   artifacts(id, session_id, name, cells, created_at)
 *
 * Design choices:
 *   - Append-only messages (never delete, compacted messages retain summaries)
 *   - Artifacts stored separately (compact manifests in chat, full data in artifacts table)
 *   - Auto-generated titles from first user message
 *
 * TODO: Implement SQLite schema and CRUD operations
 */

export const SESSION_DB_SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  name TEXT NOT NULL,
  cells TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
