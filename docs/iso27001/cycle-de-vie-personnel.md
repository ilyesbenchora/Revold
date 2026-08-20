# Cycle de vie du personnel — SMSI Revold

Version 1.0 · 2026-08-20 · Couvre les contrôles SoA 6.1 (vérification des
antécédents), 6.2 (conditions d'embauche), 6.6 (confidentialité), 5.11 / 6.5
(restitution des actifs et fin de contrat).

## 1. Avant l'embauche (6.1)

Vérifications proportionnées au poste, dans le respect du droit du travail :
- Identité et droit de travailler ; diplômes/certifications si déterminants.
- **Deux références professionnelles** contactées pour tout poste avec accès production.
- Cohérence du parcours (entretiens croisés). Aucune collecte excessive (pas de casier
  hors obligation légale).

## 2. À l'embauche (6.2, 6.6)

Le contrat (ou le contrat de prestation) inclut la clause type suivante :

> **Clause de sécurité et de confidentialité.** Le collaborateur s'engage à respecter
> la Politique de Sécurité des Systèmes d'Information de Revold et la Charte
> d'utilisation qui lui sont remises, dont il reconnaît avoir pris connaissance. Il
> s'engage à une confidentialité absolue sur les données des clients de Revold et les
> informations internes non publiques, pendant le contrat et **sans limitation de
> durée après son terme**. Il utilise les accès qui lui sont confiés exclusivement
> pour les besoins de ses fonctions, signale sans délai tout incident de sécurité,
> et restitue à son départ l'ensemble des matériels, accès et informations. Le
> non-respect de la présente clause constitue une faute pouvant justifier une
> sanction disciplinaire et engager sa responsabilité.

Jour 1 : signature de la **charte utilisateur**, création des comptes strictement
nécessaires (politique de contrôle d'accès), **MFA avant tout accès production**,
sensibilisation sécurité initiale (30 min : phishing, secrets, signalement).

## 3. Pendant le contrat

- Sensibilisation annuelle (consignée : date, participants, thèmes).
- Droits ajustés à chaque changement de rôle (jour même).

## 4. Départ (5.11, 6.5) — checklist à exécuter sous 24 h

| # | Action | Fait |
| --- | --- | --- |
| 1 | Désactivation du compte Google Workspace (ou transfert + désactivation) | ☐ |
| 2 | Retrait GitHub (org + repos) | ☐ |
| 3 | Retrait Vercel (équipe) | ☐ |
| 4 | Retrait Supabase (organisation + projets) | ☐ |
| 5 | Retrait Stripe, Resend, Twilio, ElevenLabs et tout SaaS listé à l'inventaire | ☐ |
| 6 | Retrait du gestionnaire de mots de passe + **rotation des secrets partagés** auxquels la personne avait accès | ☐ |
| 7 | Restitution du matériel ; **effacement sécurisé** du poste (7.14) | ☐ |
| 8 | Désactivation du profil applicatif Revold (profiles) si compte interne | ☐ |
| 9 | Rappel écrit de la clause de confidentialité post-contrat | ☐ |
| 10 | Mise à jour de l'inventaire des actifs et de cette fiche (date, exécutant) | ☐ |

## Journal

| Personne | Arrivée (charte signée le) | Départ (checklist close le) |
| --- | --- | --- |
| | | |

---
Historique : v1.0 (2026-08-20) — création.
