INSERT INTO model_profiles (id, provider, model_name, fallback_profile_id, config_json, created_at)
VALUES
  ('model_cso', 'anthropic', 'claude-3.5-sonnet', NULL, '{}', datetime('now')),
  ('model_research', 'local', 'llama3.1:70b', NULL, '{}', datetime('now')),
  ('model_data', 'google', 'gemini-2.0-flash', NULL, '{}', datetime('now')),
  ('model_review', 'xai', 'grok-3', NULL, '{}', datetime('now'))
ON CONFLICT(id) DO NOTHING;

INSERT INTO agents (id, name, role, model_profile_id, status, parent_id, created_at, updated_at)
VALUES
  ('agent_cso', 'CSO', 'chief_orchestration', 'model_cso', 'online', NULL, datetime('now'), datetime('now')),
  ('agent_research', 'Web Researcher', 'research', 'model_research', 'online', 'agent_cso', datetime('now'), datetime('now')),
  ('agent_data', 'Data Analyst', 'analysis', 'model_data', 'online', 'agent_cso', datetime('now'), datetime('now')),
  ('agent_review', 'Review and Polish', 'review', 'model_review', 'online', 'agent_cso', datetime('now'), datetime('now'))
ON CONFLICT(id) DO NOTHING;
