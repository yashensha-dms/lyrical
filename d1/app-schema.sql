-- D1 Schema for Songwriting Application (songwriting-db)

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Demo',
  writers TEXT NOT NULL DEFAULT '[]',
  producers TEXT NOT NULL DEFAULT '[]',
  featured_artists TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_collaborators (
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  PRIMARY KEY (project_id, user_id),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS graveyard (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  project_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS phrases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scrapbook_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS voice_memos (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_user_id ON project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_graveyard_user_id ON graveyard(user_id);
CREATE INDEX IF NOT EXISTS idx_phrases_user_id ON phrases(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_memos_project_id ON voice_memos(project_id);
