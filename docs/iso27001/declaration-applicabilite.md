# Déclaration d'Applicabilité (SoA) — ISO/IEC 27001:2022 Annexe A

Version 1.0 · 2026-08-20 · 93 contrôles. Statuts : **✅ Appliqué** · **🟡 Partiel** ·
**🔴 À faire** · **N.A.** (non applicable, justifié). C'est LE document que l'auditeur
lit en premier — le tenir à jour à chaque évolution.

## 5. Contrôles organisationnels (37)

| # | Contrôle | Statut | Commentaire |
| --- | --- | --- | --- |
| 5.1 | Politiques de sécurité | ✅ | PSSI v1.0 + politiques dédiées |
| 5.2 | Rôles et responsabilités | 🟡 | Responsable SMSI désigné ; formaliser à l'embauche |
| 5.3 | Séparation des tâches | 🟡 | Équipe réduite : compensé par journalisation + revues |
| 5.4 | Responsabilités de la direction | ✅ | Engagement PSSI §1 |
| 5.5 | Contacts avec les autorités | 🔴 | Lister CNIL / ANSSI-CERT-FR + procédure de contact |
| 5.6 | Contacts groupes spécialisés | 🔴 | Veille : s'abonner CERT-FR, listes Supabase/Vercel security |
| 5.7 | Renseignement sur les menaces | 🟡 | Alertes de sécurité des fournisseurs suivies ; formaliser |
| 5.8 | Sécurité dans les projets | ✅ | Revue de code systématique, RLS dès la conception |
| 5.9 | Inventaire des actifs | 🟡 | Stack documentée (architecture.html) ; ajouter postes/comptes |
| 5.10 | Utilisation correcte des actifs | 🔴 | Charte utilisateur à signer |
| 5.11 | Restitution des actifs | 🔴 | Checklist départ (comptes, matériel) |
| 5.12 | Classification de l'information | 🟡 | Implicite (client/interne/public) ; écrire la grille |
| 5.13 | Marquage de l'information | N.A. | Volume documentaire ne le justifiant pas (revu annuellement) |
| 5.14 | Transfert de l'information | ✅ | TLS partout, aucun export non chiffré |
| 5.15 | Contrôle d'accès | ✅ | RBAC + RLS + pôles (politique dédiée) |
| 5.16 | Gestion des identités | ✅ | Une identité par personne, Supabase Auth |
| 5.17 | Authentification | ✅ | MFA interne, SSO SAML clients, gestionnaire de mdp |
| 5.18 | Droits d'accès | 🟡 | Attribution par rôle ; instaurer la revue trimestrielle |
| 5.19 | Sécurité fournisseurs | ✅ | Politique fournisseurs + liste sous-traitants |
| 5.20 | Exigences sécurité contrats fournisseurs | 🟡 | DPA signés ; clause sécurité type à ajouter |
| 5.21 | Chaîne d'approvisionnement TIC | 🟡 | Dépendances épinglées ; ajouter audit npm périodique |
| 5.22 | Suivi des services fournisseurs | 🟡 | Status pages suivies ; formaliser la revue annuelle |
| 5.23 | Sécurité du cloud | ✅ | Choix UE, chiffrement, RLS, moindre privilège |
| 5.24 | Préparation aux incidents | ✅ | Procédure gestion-incidents.md |
| 5.25 | Évaluation des événements | ✅ | Grille de qualification dans la procédure |
| 5.26 | Réponse aux incidents | ✅ | Étapes containment → éradication → retour |
| 5.27 | Apprendre des incidents | ✅ | Post-mortem obligatoire |
| 5.28 | Collecte de preuves | 🟡 | Logs disponibles ; définir la préservation |
| 5.29 | Sécurité pendant une perturbation | ✅ | PCA/PRA |
| 5.30 | Continuité TIC | ✅ | Sauvegardes + RTO/RPO définis |
| 5.31 | Exigences légales | ✅ | RGPD (registre, DPA), CGU |
| 5.32 | Propriété intellectuelle | ✅ | Licences OSS conformes |
| 5.33 | Protection des enregistrements | ✅ | Sauvegardes, rétention définie |
| 5.34 | Vie privée / DCP | ✅ | RGPD : minimisation, droits, sous-traitants |
| 5.35 | Revue indépendante | 🔴 | Pentest externe + audit interne à planifier (M2/M3) |
| 5.36 | Conformité aux politiques | 🟡 | Auto-évaluation ; outillage (Vanta/Drata) recommandé |
| 5.37 | Procédures d'exploitation | ✅ | Runbooks docs/ops (SSO, migrations auto, crons) |

## 6. Contrôles liés aux personnes (8)

| # | Contrôle | Statut | Commentaire |
| --- | --- | --- | --- |
| 6.1 | Vérification des antécédents | 🔴 | À instaurer avant première embauche |
| 6.2 | Conditions d'embauche | 🔴 | Clause sécurité/confidentialité type |
| 6.3 | Sensibilisation | 🟡 | Culture sécurité réelle ; session formelle annuelle à créer |
| 6.4 | Processus disciplinaire | ✅ | PSSI §5 |
| 6.5 | Fin de contrat | 🔴 | Lié à 5.11 (checklist départ) |
| 6.6 | Accords de confidentialité | 🟡 | NDA clients ok ; NDA internes à systématiser |
| 6.7 | Travail à distance | 🟡 | Postes chiffrés + MFA ; écrire la règle (Wi-Fi, écran) |
| 6.8 | Signalement d'événements | ✅ | Canal défini dans gestion-incidents.md |

## 7. Contrôles physiques (14)

| # | Contrôle | Statut | Commentaire |
| --- | --- | --- | --- |
| 7.1–7.4 | Périmètres, entrées, bureaux, surveillance | N.A. | Pas de locaux propres — full remote, datacenters gérés par AWS/Vercel (certifiés ISO 27001) |
| 7.5–7.8 | Menaces physiques, zones, bureau propre, emplacement | 🟡 | Règle « bureau propre / écran verrouillé » à écrire (télétravail) |
| 7.9 | Actifs hors site | ✅ | Postes chiffrés (FileVault/BitLocker) |
| 7.10 | Supports amovibles | ✅ | Interdits pour les données clients |
| 7.11–7.13 | Services support, câblage, maintenance | N.A. | Datacenters fournisseurs |
| 7.14 | Mise au rebut sécurisée | 🟡 | Effacement sécurisé des postes à formaliser |

## 8. Contrôles technologiques (34)

| # | Contrôle | Statut | Commentaire |
| --- | --- | --- | --- |
| 8.1 | Terminaux utilisateurs | 🟡 | Chiffrement + verrouillage ; MDM quand l'équipe grandit |
| 8.2 | Droits privilégiés | ✅ | service_role serveur uniquement, jamais côté client |
| 8.3 | Restriction d'accès à l'information | ✅ | RLS par organisation + accès par pôle vérifié serveur |
| 8.4 | Accès au code source | ✅ | GitHub privé, comptes MFA |
| 8.5 | Authentification sécurisée | ✅ | Supabase Auth (OTP, OAuth, SSO SAML), MFA interne |
| 8.6 | Dimensionnement | ✅ | Serverless auto-scalé (Vercel), quotas surveillés |
| 8.7 | Anti-malware | 🟡 | Défenses OS natives ; EDR à évaluer avec la croissance |
| 8.8 | Vulnérabilités techniques | 🟡 | Dependabot/npm audit à activer en CI + pentest M2 |
| 8.9 | Gestion des configurations | ✅ | Infra as code (vercel.json, migrations versionnées) |
| 8.10 | Suppression d'information | ✅ | Suppression sur demande + cascade organisation |
| 8.11 | Masquage des données | ✅ | Clés API masquées, pas de PAN, logs sans secrets |
| 8.12 | Prévention de fuite de données | 🟡 | Périmètre réduit ; règles d'export à documenter |
| 8.13 | Sauvegardes | ✅ | Quotidiennes (Supabase PITR) ; TEST de restauration à dater |
| 8.14 | Redondance | ✅ | Multi-AZ AWS, CDN Vercel |
| 8.15 | Journalisation | 🟡 | Logs Vercel/Supabase + cron_runs ; centralisation/rétention à définir |
| 8.16 | Surveillance | 🟡 | Monitoring crons + parité sync ; alerting infra à compléter |
| 8.17 | Synchronisation des horloges | ✅ | NTP géré par les fournisseurs |
| 8.18 | Programmes utilitaires privilégiés | ✅ | Accès prod restreint au Responsable SMSI |
| 8.19 | Installation de logiciels | ✅ | Déploiement uniquement via pipeline git → Vercel |
| 8.20 | Sécurité des réseaux | ✅ | TLS, pas de réseau propre (serverless) |
| 8.21 | Sécurité des services réseau | ✅ | Fournisseurs certifiés (AWS, Vercel, Supabase) |
| 8.22 | Ségrégation des réseaux | N.A. | Pas de réseau interne ; isolation par RLS/comptes |
| 8.23 | Filtrage web | N.A. | Pas de parc navigant administré (revu annuellement) |
| 8.24 | Cryptographie | ✅ | TLS 1.2+, AES-256 au repos, HMAC pour les states OAuth |
| 8.25 | Cycle de développement sécurisé | ✅ | Revue de code, lint/typage stricts, migrations transactionnelles |
| 8.26 | Exigences de sécurité applicatives | ✅ | RLS systématique, validation d'entrées, RBAC |
| 8.27 | Architecture sécurisée | ✅ | Documentée (architecture.html) |
| 8.28 | Codage sécurisé | ✅ | TypeScript strict, secrets hors code, revues |
| 8.29 | Tests de sécurité | 🔴 | Pentest externe à commander (M2) |
| 8.30 | Développement externalisé | N.A. | Développement interne |
| 8.31 | Séparation dev/test/prod | ✅ | Previews Vercel ≠ production, données de prod non copiées |
| 8.32 | Gestion des changements | ✅ | Git + revue + déploiement promu, rollback possible |
| 8.33 | Données de test | ✅ | Jamais de données clients en environnement de test |
| 8.34 | Protection pendant les audits | ✅ | Accès auditeur en lecture, fenêtres convenues |

**Synthèse v1.0 : 45 ✅ · 24 🟡 · 12 🔴 · 12 N.A.** → le plan d'action M1 traite les 🔴
puis les 🟡 (voir README, feuille de route).
