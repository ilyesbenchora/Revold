# Charte d'utilisation des systèmes d'information — Revold

Version 1.0 · 2026-08-20 · À signer par toute personne (salarié, fondateur,
prestataire) accédant aux systèmes Revold. Couvre les contrôles SoA 5.10 (usage
correct des actifs), 6.7 (travail à distance), 7.7 (bureau propre / écran
verrouillé), 7.14 (mise au rebut).

## 1. Poste de travail

- Disque **chiffré** (FileVault / BitLocker), session **verrouillée** dès que le poste
  est quitté (verrouillage automatique ≤ 5 min).
- Système et navigateur **à jour** (mises à jour automatiques activées).
- Aucune donnée client stockée en local hors besoin ponctuel ; suppression après usage.
- Supports amovibles (clés USB) **interdits** pour les données clients.

## 2. Comptes et secrets

- **MFA activée** sur tout compte professionnel ; mots de passe uniques générés par le
  **gestionnaire de mots de passe** de l'entreprise — jamais réutilisés, jamais
  partagés par message.
- Les secrets applicatifs (clés API, tokens) ne transitent **jamais** par email, chat
  ou code source — uniquement le coffre de secrets et les variables d'environnement.
- Compte nominatif uniquement ; l'usage du compte d'un tiers est interdit.

## 3. Travail à distance

- Wi-Fi public : uniquement avec le partage réseau désactivé ; pas d'administration
  production depuis un réseau non maîtrisé sans nécessité.
- Écran non exposé aux regards dans les lieux publics (filtre de confidentialité
  recommandé) ; conversations sensibles hors espaces publics.

## 4. Données clients

- Accès limité au besoin de la tâche (moindre privilège) ; aucune copie vers des
  outils personnels ; l'**impersonation** de comptes clients est interdite.
- Tout export contenant des données clients est chiffré et supprimé après usage.

## 5. Signalement et incidents

- Tout événement suspect (email étrange, comportement anormal, perte de matériel)
  est signalé **immédiatement** à security@revold.io — le signalement de bonne foi
  n'est jamais sanctionné, même en cas de fausse alerte ou d'erreur commise.

## 6. Départ / restitution

- À la fin de la mission : restitution du matériel, effacement sécurisé validé,
  révocation des accès (checklist du document cycle-de-vie-personnel.md).

---

**Signature** — Je reconnais avoir lu et accepté la présente charte.

| Nom | Date | Signature |
| --- | --- | --- |
| | | |

Historique : v1.0 (2026-08-20) — création.
