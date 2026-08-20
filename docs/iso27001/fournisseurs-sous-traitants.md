# Fournisseurs et sous-traitants — SMSI Revold

Version 1.0 · 2026-08-20 · Revue annuelle (certifications, DPA, incidents) — et à
chaque ajout de fournisseur. Cette liste alimente aussi la page publique
sous-traitants (transparence RGPD).

## Sous-traitants traitant des données clients

| Fournisseur | Rôle | Localisation données | Certifications (déclarées) | DPA |
| --- | --- | --- | --- | --- |
| Supabase (AWS) | Base de données, auth, stockage | UE — Francfort (eu-central-1) | SOC 2 Type II ; AWS : ISO 27001, SOC 1/2/3, PCI DSS | ✅ (inclus, à archiver) |
| Vercel | Hébergement application, functions, logs | Edge mondial, functions UE configurables | ISO 27001, SOC 2 Type II | ✅ (inclus, à archiver) |
| Anthropic | Modèles IA (agents, rédaction de notifications) | US — **aucun entraînement sur les données**, rétention limitée | SOC 2 Type II | ✅ (Commercial Terms + DPA) |
| Stripe | Lecture des données de facturation clients (API) + paiements Revold | UE/US selon flux | PCI DSS Level 1, SOC 1/2 | ✅ |
| Resend | Envoi d'emails transactionnels | US/UE | SOC 2 Type II | ✅ |
| Twilio | SMS / WhatsApp (notifications) | US/UE | ISO 27001, SOC 2 | ✅ |
| ElevenLabs | Synthèse vocale (tour de contrôle) | US/UE | SOC 2 Type II | À vérifier/archiver |
| Google (OAuth, APIs connectées) | Connexion Google, connecteurs Ads/Analytics | UE/US | ISO 27001, SOC 1/2/3 | ✅ |

> Règle : privilégier l'hébergement UE ; pour les transferts hors UE, s'appuyer sur
> les Clauses Contractuelles Types (SCC) du DPA du fournisseur + mesures
> complémentaires (chiffrement, minimisation).

## Critères d'entrée d'un nouveau fournisseur

1. Traite-t-il des données clients ? Si oui : DPA obligatoire AVANT mise en prod.
2. Localisation UE possible ? La privilégier.
3. Certifications (ISO 27001 / SOC 2) vérifiées et archivées.
4. Ajout à cette liste + à la page publique + à l'inventaire des actifs.

## Sortie d'un fournisseur

Export/suppression des données chez le fournisseur, révocation des clés, retrait des
listes, note dans l'historique.

---
Historique : v1.0 (2026-08-20) — création, 8 sous-traitants recensés.
