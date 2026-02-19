PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  model_profile_id TEXT NOT NULL,
  model_provider TEXT,
  model_name TEXT,
  api_key_encrypted BLOB,
  temperature REAL DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 8192,
  status TEXT NOT NULL,
  parent_id TEXT NULL,
  last_heartbeat TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hierarchy_edges (
  id TEXT PRIMARY KEY,
  parent_agent_id TEXT NOT NULL,
  child_agent_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  assignee_agent_id TEXT NULL,
  parent_task_id TEXT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_events (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  task_id TEXT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS model_profiles (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  fallback_profile_id TEXT NULL,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cost_snapshots (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  granted INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  slug TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  summary TEXT,
  author TEXT,
  downloads INTEGER NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  stats_json TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  permissions_json TEXT NOT NULL,
  installed INTEGER NOT NULL DEFAULT 0,
  last_fetched TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id TEXT NOT NULL,
  skill_slug TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  assigned_at TEXT NOT NULL,
  PRIMARY KEY (agent_id, skill_slug)
);

CREATE TABLE IF NOT EXISTS agent_stats (
  agent_id TEXT PRIMARY KEY,
  tokens_today INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  last_updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id TEXT PRIMARY KEY,
  swarm_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  state_json TEXT NOT NULL,
  prompt_snapshot TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budgets (
  agent_id TEXT PRIMARY KEY,
  token_limit INTEGER NOT NULL,
  cost_limit_usd REAL NOT NULL,
  current_tokens INTEGER NOT NULL DEFAULT 0,
  current_cost_usd REAL NOT NULL DEFAULT 0,
  hard_kill INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_servers (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  capabilities_json TEXT NOT NULL,
  auth_json TEXT NOT NULL,
  connected_agents_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS episodic_memories (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  embedding_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoffs (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  task_id TEXT,
  checkpoint_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_graphs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  graph_json TEXT NOT NULL,
  checkpoint_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  markdown_summary TEXT NOT NULL,
  vector_embedding BLOB,
  importance_score INTEGER NOT NULL,
  tags_json TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  version INTEGER NOT NULL,
  blob_path TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  encrypted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vault_versions (
  entry_id TEXT NOT NULL,
  version_num INTEGER NOT NULL,
  blob_path TEXT,
  diff TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, version_num)
);

CREATE TABLE IF NOT EXISTS storage_stats (
  snapshot_time TEXT PRIMARY KEY,
  archive_gb REAL NOT NULL,
  files_gb REAL NOT NULL,
  total_gb REAL NOT NULL,
  free_gb REAL NOT NULL
);
