/**
 * Central dispatcher to validate credentials before persisting an integration.
 *
 * Each tool's ping function lives in `lib/integrations/sources/{tool}.ts`.
 * Token-based tools must pass here BEFORE we mark `is_active = true` in DB,
 * otherwise pilots see "Connecté" on garbage tokens and the next sync fails
 * silently.
 *
 * Communication tools (Slack/Teams/Gmail/Outlook) and webhook-receivers
 * (Praiz) do NOT have outbound API calls to ping — we validate URL shape
 * (Slack/Teams) or accept the secret as-is (Praiz, recipients).
 */

import { pingPipedrive } from "./sources/pipedrive";
import { pingStripeDetailed } from "./sources/stripe";
import { pingSalesforce } from "./sources/salesforce";
import { pingZoho } from "./sources/zoho";
import { pingMonday } from "./sources/monday";
import { pingPennylane } from "./sources/pennylane";
import { pingSellsy } from "./sources/sellsy";
import { pingAxonaut } from "./sources/axonaut";
import { pingQuickBooks } from "./sources/quickbooks";
import { pingIntercom } from "./sources/intercom";
import { pingZendesk } from "./sources/zendesk";
import { pingCrisp } from "./sources/crisp";
import { pingFreshdesk } from "./sources/freshdesk";

export type PingResult =
  | { ok: true }
  | { ok: false; reason: string };

function looksLikeHttpsUrl(value: string, hostHint?: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== "https:") return false;
    if (hostHint && !u.hostname.endsWith(hostHint)) return false;
    return true;
  } catch {
    return false;
  }
}

function validRecipients(raw: string): boolean {
  const list = raw.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return false;
  return list.every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

/**
 * Validate the creds posted from the connect form.
 * Returns { ok: true } if the integration would actually work, otherwise
 * { ok: false, reason } with a French human-readable reason.
 */
export async function pingTool(
  toolKey: string,
  creds: Record<string, string>,
): Promise<PingResult> {
  try {
    switch (toolKey) {
      // ── CRM ──────────────────────────────────────────────────────
      case "salesforce": {
        const ok = await pingSalesforce(creds.instance_url, creds.security_token);
        return ok ? { ok: true } : { ok: false, reason: "Salesforce a refusé les identifiants (instance URL ou Security Token invalides)." };
      }
      case "pipedrive": {
        const ok = await pingPipedrive(creds.company_domain, creds.api_token);
        return ok ? { ok: true } : { ok: false, reason: "Pipedrive a refusé les identifiants (sous-domaine ou API token invalides)." };
      }
      case "zoho": {
        const ok = await pingZoho(creds.data_center, creds.client_id, creds.client_secret, creds.refresh_token);
        return ok ? { ok: true } : { ok: false, reason: "Zoho a refusé les identifiants (data center, client ID, secret ou refresh token invalides)." };
      }
      case "monday": {
        const ok = await pingMonday(creds.api_token);
        return ok ? { ok: true } : { ok: false, reason: "monday a refusé l'API token." };
      }

      // ── Billing ──────────────────────────────────────────────────
      case "stripe": {
        const result = await pingStripeDetailed(creds.secret_key);
        if (result.ok) return { ok: true };
        const reason = result.hint ? `${result.reason} ${result.hint}` : result.reason;
        return { ok: false, reason };
      }
      case "pennylane": {
        const ok = await pingPennylane(creds.api_token);
        return ok ? { ok: true } : { ok: false, reason: "Pennylane a refusé l'API token." };
      }
      case "sellsy": {
        const ok = await pingSellsy(creds.client_id, creds.client_secret);
        return ok ? { ok: true } : { ok: false, reason: "Sellsy a refusé le couple Client ID / Client Secret." };
      }
      case "axonaut": {
        const ok = await pingAxonaut(creds.api_key);
        return ok ? { ok: true } : { ok: false, reason: "Axonaut a refusé l'API Key." };
      }
      case "quickbooks": {
        const ok = await pingQuickBooks(creds.company_id, creds.client_id, creds.client_secret, creds.refresh_token);
        return ok ? { ok: true } : { ok: false, reason: "QuickBooks a refusé les identifiants (Realm ID, client, secret ou refresh token invalides)." };
      }

      // ── Téléphonie (placeholders) ────────────────────────────────
      case "aircall":
      case "ringover":
        return { ok: false, reason: "Connecteur en cours de développement — disponible bientôt." };

      // ── Service client ───────────────────────────────────────────
      case "intercom": {
        const ok = await pingIntercom(creds.access_token);
        return ok ? { ok: true } : { ok: false, reason: "Intercom a refusé l'Access Token." };
      }
      case "zendesk": {
        const ok = await pingZendesk(creds.subdomain, creds.email, creds.api_token);
        return ok ? { ok: true } : { ok: false, reason: "Zendesk a refusé les identifiants (sous-domaine, email ou API token invalides)." };
      }
      case "crisp": {
        const ok = await pingCrisp(creds.website_id, creds.identifier, creds.key);
        return ok ? { ok: true } : { ok: false, reason: "Crisp a refusé les identifiants du plugin (Website ID, Identifier ou Key invalides)." };
      }
      case "freshdesk": {
        const ok = await pingFreshdesk(creds.subdomain, creds.api_key);
        return ok ? { ok: true } : { ok: false, reason: "Freshdesk a refusé les identifiants (sous-domaine ou API Key invalides)." };
      }

      // ── Communication (validation de forme uniquement) ───────────
      case "slack":
        return looksLikeHttpsUrl(creds.webhook_url, "slack.com")
          ? { ok: true }
          : { ok: false, reason: "URL invalide — attendu une URL HTTPS de type https://hooks.slack.com/services/..." };
      case "teams":
        return looksLikeHttpsUrl(creds.webhook_url)
          ? { ok: true }
          : { ok: false, reason: "URL invalide — attendu l'URL HTTPS du connecteur Incoming Webhook Teams." };
      case "gmail":
      case "outlook":
        return validRecipients(creds.recipients)
          ? { ok: true }
          : { ok: false, reason: "Liste de destinataires invalide — séparez les emails par virgule." };

      // ── Conversation Intelligence (webhook receiver) ─────────────
      case "praiz":
        return creds.webhook_secret && creds.webhook_secret.length >= 16
          ? { ok: true }
          : { ok: false, reason: "Secret webhook trop court — utilisez 32+ caractères (openssl rand -hex 32)." };

      // ── HubSpot passe par OAuth, jamais ici ──────────────────────
      case "hubspot":
        return { ok: false, reason: "HubSpot utilise OAuth — passez par /api/integrations/hubspot/connect." };

      default:
        return { ok: false, reason: `Outil inconnu : ${toolKey}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `Erreur réseau ou API : ${msg.slice(0, 160)}` };
  }
}
