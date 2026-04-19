/**
 * GET /api/integrations/hubspot/debug/scopes
 *
 * Endpoint debug : retourne la liste exacte des scopes que le code Revold
 * actuellement déployé demanderait dans l'URL OAuth, plus l'URL OAuth
 * complète qui serait générée. Permet de vérifier de visu ce qui est envoyé
 * à HubSpot vs ce qui est configuré dans le dev portal.
 *
 * Pas d'auth requise (lecture seule, pas de secret exposé) — le client_id
 * est public côté HubSpot oauth dialog de toute façon.
 */
import { NextResponse } from "next/server";
import { getEffectiveOAuthScopes, getHubSpotAuthUrl } from "@/lib/integrations/hubspot";

export const dynamic = "force-dynamic";

export async function GET() {
  const { required, optional, optionalSource } = getEffectiveOAuthScopes();
  const sampleUrl = getHubSpotAuthUrl("DEBUG_STATE.NONCE.SIG");
  return NextResponse.json({
    required: { count: required.length, scopes: required },
    optional: { count: optional.length, scopes: optional, source: optionalSource },
    total: required.length + optional.length,
    sampleAuthUrl: sampleUrl,
    note: optionalSource === "env"
      ? "Optional scopes are loaded from HUBSPOT_OAUTH_OPTIONAL_SCOPES env var (override active)."
      : "Optional scopes use the default conservative list. Set HUBSPOT_OAUTH_OPTIONAL_SCOPES env var to override.",
    deployedAt: new Date().toISOString(),
  });
}
