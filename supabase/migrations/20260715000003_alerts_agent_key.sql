-- Agent Revold à l'origine de l'alerte (créée depuis le chat d'un agent).
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS agent_key text;
CREATE INDEX IF NOT EXISTS idx_alerts_agent_key ON alerts (organization_id, agent_key);
