# Registre des risques — SMSI Revold

Version 1.0 · 2026-08-20 · Cotation : Probabilité × Impact (1-4 chacun) → criticité
(≥ 9 critique, 6-8 élevé, 3-5 modéré, ≤ 2 faible). Revue semestrielle + à chaque
incident ou évolution majeure.

| ID | Risque | P | I | Crit. | Traitement | Contrôles (SoA) |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Fuite de données inter-clients (défaut d'isolation) | 1 | 4 | 4 | RLS au niveau base sur toutes les tables + revue systématique des nouvelles tables | 8.3, 8.26 |
| R2 | Compromission d'un compte à privilèges (fondateur, GitHub, Vercel, Supabase) | 2 | 4 | 8 | MFA partout, gestionnaire de mdp, service_role jamais côté client, rotation en cas de doute | 5.17, 8.2 |
| R3 | Fuite de secrets (clé service_role, tokens OAuth clients) | 2 | 4 | 8 | Env vars Vercel uniquement, jamais en git, tokens chiffrés en base, scan de secrets | 8.11, 8.28 |
| R4 | Vulnérabilité dépendance npm exploitée | 2 | 3 | 6 | Épinglage, audit dépendances en CI (à activer), veille CERT-FR | 8.8, 5.21 |
| R5 | Indisponibilité fournisseur (Vercel/Supabase) | 2 | 3 | 6 | Multi-AZ, sauvegardes quotidiennes, PRA documenté, status pages surveillées | 5.30, 8.13/8.14 |
| R6 | Perte de données (erreur humaine, migration ratée) | 2 | 4 | 8 | Migrations transactionnelles (échec = build bloqué), PITR Supabase, test de restauration périodique | 8.13, 8.32 |
| R7 | Abus des écritures vers les outils clients | 1 | 3 | 3 | Écritures limitées à 3 actions validées, « champs vides uniquement », journal des actions | 5.15, 8.26 |
| R8 | Ingénierie sociale / phishing sur l'équipe | 3 | 3 | 9 | MFA (résiste au vol de mdp), sensibilisation annuelle, procédure de signalement | 6.3, 6.8 |
| R9 | Départ d'une personne clé sans réversibilité | 2 | 3 | 6 | Documentation (runbooks, architecture), secrets dans un coffre partagé, checklist départ | 5.11, 5.37 |
| R10 | Non-conformité RGPD (droits, notification 72 h) | 1 | 4 | 4 | Registre, DPA, procédure incident avec volet CNIL, export/suppression outillés | 5.31, 5.34 |
| R11 | Poste de travail perdu/volé | 2 | 3 | 6 | Chiffrement disque, verrouillage auto, révocation de session à distance | 7.9, 8.1 |
| R12 | Prompt injection / abus des agents IA sur données clients | 2 | 3 | 6 | Agents en lecture via moteur déterministe (pas d'écriture libre), validation humaine des actions | 8.26 |

**Risques ≥ 8 (élevés/critiques)** : R2, R3, R6, R8 — traités en priorité au jalon M1 ;
R8 (phishing) est le seul coté 9 : la session de sensibilisation formelle est le
premier livrable du plan d'action.

---
Historique : v1.0 (2026-08-20) — création, 12 risques initiaux.
