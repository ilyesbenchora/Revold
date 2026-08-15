-- Contexte métier d'un connecteur sur mesure :
--  · description : à quoi sert l'outil, dans les mots du client. Injectée aux
--    agents IA (ils savent alors ce que « GAIA » signifie dans son métier) et
--    utilisée pour proposer les bons rattachements de pages.
--  · category : famille de l'outil (facturation, CRM, support…) — pilote les
--    pages et agents auxquels il est rattaché par défaut.
ALTER TABLE custom_connectors ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE custom_connectors ADD COLUMN IF NOT EXISTS category text DEFAULT 'billing';
