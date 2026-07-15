-- Sessions WhatsApp : mémorise, par numéro d'expéditeur, l'agent Revold choisi
-- et le fil de conversation. Écrites par le webhook (service-role).
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  wa_from         text NOT NULL,              -- numéro WhatsApp de l'utilisateur
  agent_key       text,                       -- agent sélectionné (null = menu à venir)
  messages        jsonb NOT NULL DEFAULT '[]',-- historique {role, content} (borné)
  last_msg_id     text,                        -- dernier message WhatsApp traité (anti-doublon)
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, wa_from)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_from ON whatsapp_sessions (wa_from);

ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
-- Accès applicatif via service-role (webhook) uniquement ; pas de policy publique.
