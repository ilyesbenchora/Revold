-- Effectifs & CA des CANDIDATS en attente de validation : le moteur les
-- récupère déjà dans la même réponse du registre que l'identité — on les
-- persiste pour les AFFICHER dans le tableau de validation (l'utilisateur
-- décide en voyant la taille réelle de l'entreprise) et les appliquer d'un
-- seul geste à la validation.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_employee_range text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_employee_year int;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_revenue numeric;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS candidate_revenue_year int;
