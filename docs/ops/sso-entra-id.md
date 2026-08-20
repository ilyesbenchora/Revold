# Runbook — Activer le SSO SAML d'un client (Microsoft Entra ID, Okta, Google Workspace)

Le SSO produit passe par **Supabase Auth (SAML 2.0)** : un fournisseur d'identité (IdP)
est enregistré **par client**, associé à son **domaine email**. Côté app, la page de
connexion (`/login?mode=sso`) appelle `signInWithSSO({ domain })` — rien d'autre à coder.

> Prérequis : plan Supabase avec SAML SSO activé (Pro + add-on SSO). Activer une fois
> dans Dashboard → Authentication → Providers → SAML 2.0.

## 1. Côté client (son équipe IT — Entra ID)

Envoyer au DSI ces valeurs (identiques pour tous les clients) :

| Champ Entra ID (Enterprise App → SAML) | Valeur |
| --- | --- |
| Identifier (Entity ID) | `https://<project-ref>.supabase.co/auth/v1/sso/saml/metadata` |
| Reply URL (ACS) | `https://<project-ref>.supabase.co/auth/v1/sso/saml/acs` |
| Attributs à mapper | `email` (obligatoire), `name` (souhaité) |

Le client crée une « Enterprise Application » non-galerie, colle ces URLs, assigne les
utilisateurs/groupes autorisés, puis fournit son **App Federation Metadata URL**.

## 2. Côté Revold (CLI Supabase, une commande)

```bash
supabase sso add --type saml \
  --project-ref <project-ref> \
  --metadata-url "https://login.microsoftonline.com/<tenant-id>/federationmetadata/2007-06/federationmetadata.xml?appid=<app-id>" \
  --domains acme.fr,acme.com \
  --attribute-mapping-file ./sso-attrs.json
```

`sso-attrs.json` minimal :

```json
{ "keys": { "email": { "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress" },
            "name":  { "name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name" } } }
```

Vérifier : `supabase sso list --project-ref <project-ref>`.

## 3. Rattachement à l'organisation Revold

Un utilisateur SSO inconnu arrive **sans organisation** : `getOrgId()` lui en créerait
une nouvelle. Pour un client existant, préparer le rattachement AVANT l'annonce :
créer les profils (`profiles.organization_id`) des emails attendus, ou activer le
rapprochement par domaine si/quand il existe. À défaut, premier login SSO → org
orpheline à fusionner à la main (à éviter).

## 4. Test de bout en bout

1. `/login?mode=sso` → email `prenom@acme.fr` → redirection vers la mire Microsoft.
2. Authentification (MFA de l'entreprise incluse) → retour `/auth/callback` → dashboard.
3. Vérifier le profil/l'org, puis noter l'activation dans la fiche client.

## Dépannage

- « SSO non configuré pour ce domaine » → le domaine n'est pas dans `--domains` du
  provider (`supabase sso show`), ou le provider n'est pas créé.
- Boucle de redirection → Reply URL mal copiée côté Entra ID.
- `AADSTS…` → l'utilisateur n'est pas assigné à l'Enterprise App côté client.
