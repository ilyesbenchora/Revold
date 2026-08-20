# Plan de continuité et de reprise (PCA / PRA) — SMSI Revold

Version 1.0 · 2026-08-20 · Objectifs : **RPO 24 h** (perte de données max) ·
**RTO 8 h** (retour du service). À resserrer avec les engagements clients.

## Sauvegardes

- **Base de données (Supabase/AWS Francfort)** : sauvegardes quotidiennes gérées +
  Point-In-Time Recovery selon le plan souscrit. Les migrations sont
  transactionnelles et bloquent le build en cas d'échec (jamais de code déployé sans
  son schéma).
- **Code** : GitHub (historique complet) ; le déploiement est reconstructible depuis
  n'importe quel commit.
- **Configuration** : variables d'environnement Vercel — exportées chiffrées dans le
  coffre de secrets à chaque ajout/modification (à instaurer, jalon M1).
- **Test de restauration** : au moins **semestriel**, sur projet Supabase de test,
  consigné dans le journal ci-dessous. Un backup non testé n'est pas un backup.

## Scénarios

| Scénario | Réponse | Délai visé |
| --- | --- | --- |
| Déploiement défectueux | Rollback instantané Vercel (déploiement précédent promu) | < 15 min |
| Corruption / perte de données | Restauration PITR au dernier point sain | < 4 h |
| Indisponibilité Vercel | Attente incident fournisseur (multi-AZ) ; communication clients ; si prolongé : redéploiement du repo sur infra alternative | 8 h |
| Indisponibilité Supabase | Idem — multi-AZ AWS ; restauration du dernier backup sur nouveau projet en dernier recours | 8 h |
| Perte du poste du fondateur | Accès reconstructibles depuis le coffre de secrets + MFA de secours (codes de récupération imprimés, hors ligne) | < 4 h |

## Communication de crise

Statut incident communiqué aux clients par email (Resend) et bannière in-app ;
canal de secours si Resend est down : messagerie du fondateur. Points réguliers
tant que l'incident dure ; synthèse écrite à la clôture.

## Journal des tests de restauration

| Date | Périmètre | Durée | Résultat | Écarts |
| --- | --- | --- | --- | --- |
| (premier test à dater — jalon M2) | | | | |

---
Historique : v1.0 (2026-08-20) — création.
