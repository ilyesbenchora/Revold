-- Outils à croiser pré-sélectionnés pour la séance de coaching d'une catégorie.
-- Liste de clés de sources (ex: ["hubspot","stripe"]) chargée automatiquement
-- au démarrage du chat de coaching.
ALTER TABLE coaching_agendas
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]';

-- Fichiers de contexte joints à l'agenda (Excel/CSV/Google Sheets) : nom,
-- colonnes, aperçu, nb de lignes. Repris par l'agent coach dans la séance.
ALTER TABLE coaching_agendas
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
