# Contacts autorités & veille sécurité — SMSI Revold

Version 1.0 · 2026-08-20 · Couvre les contrôles SoA 5.5 (contacts avec les
autorités), 5.6 (groupes spécialisés) et 5.7 (renseignement sur les menaces).

## 1. Autorités (5.5) — qui contacter, quand

| Autorité | Quand | Canal |
| --- | --- | --- |
| **CNIL** | Violation de données personnelles avec risque pour les personnes — notification **≤ 72 h** | Téléservice notification : cnil.fr → « Notifier une violation » (compte organisme à créer en amont, hors incident) |
| **CERT-FR (ANSSI)** | Incident cyber significatif, demande d'assistance ou signalement | cert-fr.cossi@ssi.gouv.fr · +33 (0)1 71 75 84 68 (24/7) |
| **cybermalveillance.gouv.fr** | Assistance/diagnostic, dépôt de plainte guidé | Plateforme en ligne |
| **Police/Gendarmerie (plainte)** | Intrusion, extorsion, vol de données | Dépôt de plainte (BL2C/BEC selon ressort) |
| **Assureur cyber** | Dès qualification P1/P2 (délais contractuels) | Numéro du contrat — à reporter ici à la souscription |

> Action préalable (hors incident) : créer le compte CNIL de l'organisme et reporter
> ici l'identifiant, pour ne pas perdre d'heures pendant un incident réel.

## 2. Veille et groupes spécialisés (5.6, 5.7)

Sources suivies (revue **hebdomadaire**, le lundi — 15 min, consignée en cas d'action) :

| Source | Contenu | Abonnement |
| --- | --- | --- |
| CERT-FR — avis & alertes | Vulnérabilités critiques, campagnes actives | Flux RSS / email cert.ssi.gouv.fr |
| GitHub Security Advisories + Dependabot | Vulnérabilités des dépendances du repo | Activé sur le repo (+ workflow security-audit hebdo) |
| Status & security : Vercel, Supabase, Stripe, Anthropic | Incidents fournisseurs, avis de sécurité | Status pages + emails de service |
| Next.js / Node.js security releases | Patches du socle applicatif | Blog releases + Dependabot |
| OWASP (Top 10, cheat sheets) | Référentiel pour les revues de code | Consultation lors des revues |

Règle de traitement : une vulnérabilité **critique** touchant un composant utilisé →
patch ou mitigation **≤ 72 h** ; **haute** → ≤ 7 jours ; consigné dans le journal.

## Journal de veille (actions uniquement)

| Date | Source | Sujet | Action |
| --- | --- | --- | --- |
| | | | |

---
Historique : v1.0 (2026-08-20) — création.
