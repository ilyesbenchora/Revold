# SMSI Revold — démarche ISO/IEC 27001:2022

Ce dossier est le **socle documentaire** du Système de Management de la Sécurité de
l'Information (SMSI) de Revold, aligné sur ISO/IEC 27001:2022. Il sert trois usages :
répondre aux questionnaires sécurité des DSI dès aujourd'hui, structurer la sécurité
réelle de l'entreprise, et préparer l'audit de certification.

> **Statut de communication autorisé** : « SMSI aligné ISO/IEC 27001, démarche de
> certification engagée ». Ne JAMAIS écrire « certifié » avant le certificat.

## Périmètre du SMSI

La plateforme SaaS Revold (revold.io) : application, APIs, base de données, connecteurs
aux outils clients, postes de travail des personnes y accédant. Hébergement Vercel
(app) + Supabase/AWS eu-central-1 Francfort (données).

## Documents du SMSI

| Document | Rôle |
| --- | --- |
| [pssi.md](pssi.md) | Politique de sécurité (engagement, organisation, règles cadres) |
| [declaration-applicabilite.md](declaration-applicabilite.md) | SoA — les 93 contrôles Annexe A : applicabilité et état |
| [registre-risques.md](registre-risques.md) | Risques identifiés, cotation, traitement |
| [politique-controle-acces.md](politique-controle-acces.md) | Comptes, rôles, MFA, revues d'accès |
| [gestion-incidents.md](gestion-incidents.md) | Détection, réponse, notification (CNIL 72 h) |
| [pca-pra.md](pca-pra.md) | Continuité et reprise (sauvegardes, RTO/RPO) |
| [fournisseurs-sous-traitants.md](fournisseurs-sous-traitants.md) | Sous-traitants, DPA, revue annuelle |
| [charte-utilisateur.md](charte-utilisateur.md) | Charte à signer (poste, secrets, télétravail) |
| [cycle-de-vie-personnel.md](cycle-de-vie-personnel.md) | Embauche → départ (clause type, checklist 24 h) |
| [contacts-veille.md](contacts-veille.md) | Autorités (CNIL, CERT-FR) + veille sécurité |
| [cahier-des-charges-pentest.md](cahier-des-charges-pentest.md) | Cahier des charges du test d'intrusion |

## Feuille de route vers la certification

| Jalon | Échéance cible | Contenu |
| --- | --- | --- |
| M0 — Socle (ce dossier) | fait (2026-08) | PSSI, SoA (0 contrôle « À faire » restant), risques, politiques cœur, charte, cycle de vie RH, contacts autorités, CDC pentest, CI security-audit, en-têtes HTTP |
| M1 — Mise en œuvre | +2 mois | Preuves d'exploitation : 1re revue d'accès datée, test de restauration, session de sensibilisation, compte CNIL créé, Dependabot activé |
| M2 — Preuves | +4 mois | 3 mois de preuves d'exploitation (revues, tests de restauration, sensibilisation), pentest externe |
| M3 — Audit blanc | +6 mois | Audit interne + revue de direction (exigés par la norme), corrections |
| M4 — Certification | +8 à 12 mois | Audit de certification (étape 1 documentaire, étape 2 sur site) par un organisme accrédité (AFNOR, Bureau Veritas, LNE/BSI…) |

Outils recommandés pour la collecte de preuves en continu : Vanta / Drata / Scytale
(connecteurs Vercel, Supabase, GitHub, Google Workspace).

## Rôles

- **Responsable du SMSI** : le fondateur (cumul assumé au stade actuel, consigné ici).
- **Revue de direction** : semestrielle — décisions consignées en fin de chaque document.
