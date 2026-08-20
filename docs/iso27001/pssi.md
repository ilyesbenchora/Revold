# Politique de Sécurité des Systèmes d'Information (PSSI) — Revold

Version 1.0 · 2026-08-20 · Propriétaire : Responsable du SMSI · Revue : semestrielle

## 1. Engagement de la direction

Revold traite des données revenue sensibles de ses clients (CRM, facturation,
comptabilité). La direction s'engage à protéger la **confidentialité, l'intégrité et la
disponibilité** de ces données, à allouer les moyens nécessaires au SMSI, et à
l'améliorer en continu (ISO/IEC 27001:2022).

## 2. Principes cadres

1. **Isolation par organisation** : chaque table de données porte `organization_id`,
   isolée au niveau du moteur de base (Row Level Security) — pas seulement applicatif.
2. **Moindre privilège** : accès aux outils clients en **lecture seule** par défaut,
   via les identifiants du client, révocables par lui à tout moment ; les écritures
   sont limitées à trois actions explicitement validées (enrichissement CRM, tâche
   CRM, rappel de facture).
3. **Aucune donnée de paiement** : Revold ne stocke ni ne traite de numéros de carte
   (paiements opérés par Stripe, certifié PCI DSS Level 1).
4. **Hébergement Union européenne** : Vercel (app) et Supabase/AWS Francfort
   (données), chiffrement en transit (TLS 1.2+) et au repos (AES-256).
5. **Aucun entraînement d'IA** sur les données clients ; les appels aux modèles
   (Anthropic) se font sans rétention d'entraînement.
6. **Transparence** : liste publique des sous-traitants, DPA disponible, notification
   d'incident sous 72 h (RGPD).
7. **Ne jamais deviner** : une donnée manquante est affichée comme telle — principe
   produit qui vaut aussi pour la sécurité (pas de complétion silencieuse).

## 3. Organisation de la sécurité

- Responsable du SMSI : décisions de sécurité, gestion des incidents, revue des accès.
- Toute personne accédant à la production : MFA obligatoire, poste chiffré,
  gestionnaire de mots de passe, session verrouillée.
- Secrets applicatifs : variables d'environnement Vercel (jamais en dur dans le code,
  jamais dans git) ; rotation à départ d'un membre ou suspicion de fuite.

## 4. Règles par domaine (détail dans les politiques dédiées)

| Domaine | Règle cadre | Document |
| --- | --- | --- |
| Accès | RBAC (admin/manager/rep) + pôles, MFA, revue trimestrielle | politique-controle-acces.md |
| Développement | Revue de code, branches, secrets scannés, migrations transactionnelles | (ce document) |
| Incidents | Détection → containment → notification ≤ 72 h → post-mortem | gestion-incidents.md |
| Continuité | Sauvegardes quotidiennes testées, RPO 24 h / RTO 8 h | pca-pra.md |
| Fournisseurs | DPA signé, hébergement UE privilégié, revue annuelle | fournisseurs-sous-traitants.md |
| Données personnelles | Registre RGPD, minimisation, export/suppression sur demande | (site public + DPA) |

## 5. Sanctions et exceptions

Toute exception à la présente politique est documentée (motif, durée, compensation)
et validée par le Responsable du SMSI. Le non-respect délibéré expose aux sanctions
prévues au contrat de travail / de prestation.

---
Historique : v1.0 (2026-08-20) — création.
