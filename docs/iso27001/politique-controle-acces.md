# Politique de contrôle d'accès — SMSI Revold

Version 1.0 · 2026-08-20 · Revue : trimestrielle (accès) / annuelle (politique).

## Principes

- **Moindre privilège** et **besoin d'en connaître** : un accès n'est accordé que s'il
  est nécessaire au rôle, au niveau minimal suffisant.
- **Une identité nominative par personne** — comptes partagés interdits.
- **MFA obligatoire** sur tout accès aux systèmes de production et outils sensibles
  (Vercel, Supabase, GitHub, Google Workspace, Stripe).

## Dans le produit

- RBAC applicatif : `admin` > `manager` > `rep` + rattachement à un **pôle**
  (espace de travail) ; le filtrage des pages est vérifié **côté serveur**.
- Isolation des organisations par **Row Level Security** sur chaque table.
- Clients : authentification Supabase (OTP email, Google OAuth, mot de passe) et
  **SSO SAML 2.0** (Microsoft Entra ID, Okta, Google Workspace) — l'entreprise
  cliente garde le contrôle de ses identités (MFA et politiques de son annuaire).

## En interne

| Système | Qui | Niveau |
| --- | --- | --- |
| Production Supabase (données) | Responsable SMSI | Admin (service_role jamais exposé client) |
| Vercel (déploiements, env vars) | Responsable SMSI | Admin |
| GitHub (code) | Équipe dev | Écriture via revue ; admin restreint |
| Comptes clients (impersonation) | Personne | Interdit — le support travaille sur données agrégées ou avec le client en session partagée |

## Cycle de vie

1. **Arrivée** : création des comptes strictement nécessaires, MFA activée avant tout
   accès production, signature de la charte.
2. **Changement de rôle** : ajustement des droits le jour même.
3. **Départ** : révocation de tous les accès sous 24 h (checklist : Supabase, Vercel,
   GitHub, Google Workspace, Stripe, gestionnaire de mots de passe), rotation des
   secrets partagés auxquels la personne avait accès.
4. **Revue trimestrielle** : liste des comptes et droits passée en revue, écarts
   corrigés, revue consignée ci-dessous.

## Revues d'accès

| Date | Périmètre | Écarts | Actions |
| --- | --- | --- | --- |
| (première revue à dater — jalon M1) | | | |

---
Historique : v1.0 (2026-08-20) — création.
