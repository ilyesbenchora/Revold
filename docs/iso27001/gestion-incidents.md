# Procédure de gestion des incidents de sécurité — SMSI Revold

Version 1.0 · 2026-08-20 · Déclencheur : tout événement affectant la confidentialité,
l'intégrité ou la disponibilité des données ou du service.

## 1. Signalement

Toute personne (équipe, client, chercheur) peut signaler un événement :
**security@revold.io** (à créer si absent — alias vers le Responsable SMSI).
Consigner immédiatement : date/heure, source, description, systèmes concernés.

## 2. Qualification (≤ 4 h ouvrées)

| Niveau | Définition | Exemples |
| --- | --- | --- |
| P1 — Critique | Données clients exposées ou service down | Fuite inter-orgs, compromission compte admin |
| P2 — Majeur | Risque réel sans exposition avérée | Secret fuité non exploité, vulnérabilité critique publiée |
| P3 — Mineur | Sans impact données | Tentatives bloquées, bug sécurité mineur |

## 3. Réponse

1. **Contenir** : révoquer les secrets/tokens concernés, couper l'accès compromis,
   figer le déploiement si besoin (rollback Vercel).
2. **Éradiquer** : corriger la cause (patch, rotation, règle).
3. **Rétablir** : restaurer depuis sauvegarde si nécessaire (voir PCA/PRA), vérifier
   l'intégrité.
4. **Préserver les preuves** : exporter les logs pertinents (Vercel, Supabase,
   notification_log, cron_runs) AVANT toute purge.

## 4. Notification

- **Clients concernés** : sans retard injustifié, avec faits, impact, mesures.
- **CNIL** : si violation de données personnelles avec risque pour les personnes —
  **≤ 72 h** après en avoir pris connaissance (formulaire en ligne CNIL). Documenter
  la décision de notifier ou non dans tous les cas.
- **Registre des violations** tenu (obligation RGPD), même pour les non-notifiées.

## 5. Post-mortem (≤ 5 jours après clôture, obligatoire P1/P2)

Chronologie, cause racine, ce qui a fonctionné/échoué, actions correctives datées et
assignées ; mise à jour du registre des risques et de la SoA si nécessaire.

## Journal des incidents

| Date | Niveau | Résumé | Notification | Post-mortem |
| --- | --- | --- | --- | --- |
| (aucun incident à ce jour) | | | | |

---
Historique : v1.0 (2026-08-20) — création.
