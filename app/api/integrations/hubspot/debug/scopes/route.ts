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
import { HUBSPOT_OAUTH_SCOPES, getHubSpotAuthUrl } from "@/lib/integrations/hubspot";

export const dynamic = "force-dynamic";

export async function GET() {
  const scopes = HUBSPOT_OAUTH_SCOPES;
  const sampleUrl = getHubSpotAuthUrl("DEBUG_STATE.NONCE.SIG");
  return NextResponse.json({
    count: scopes.length,
    scopes,
    sampleAuthUrl: sampleUrl,
    deployedAt: new Date().toISOString(),
  });
}
