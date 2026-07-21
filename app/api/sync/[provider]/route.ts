/**
 * Generic sync trigger — POST /api/sync/{provider}
 *
 * Reads the saved credentials from the integrations table, looks up the
 * matching connector in the registry, runs it, and writes a row to sync_logs.
 *
 * Same endpoint for every directly-connected tool (Stripe, Pipedrive, Zoho,
 * Intercom, ...). The orchestrator UI calls this once after credentials are
 * saved and again whenever the user clicks "Re-synchroniser".
 */

import { NextResponse, after } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getConnector } from "@/lib/integrations/sync/registry";
import { fail } from "@/lib/integrations/sync/types";

// Le connecteur (jusqu'à ~10k lignes comptables Pennylane, pagination séquentielle
// v2) tourne EN ARRIÈRE-PLAN via after() : la requête HTTP répond en ~1 s au lieu
// de bloquer 1-2 min. Le travail de fond dispose de la durée max de la fonction.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const orgId = await getOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Aucune organisation" }, { status: 401 });
  }

  const connector = getConnector(provider);
  if (!connector) {
    return NextResponse.json(
      { error: `Aucun connecteur pour ${provider}` },
      { status: 404 },
    );
  }

  const supabase = await createSupabaseServerClient();

  // Load credentials (rapide — session utilisateur encore disponible ici).
  const { data: integration } = await supabase
    .from("integrations")
    .select("access_token, metadata")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .maybeSingle();

  if (!integration?.access_token) {
    return NextResponse.json(
      { error: `${provider} n'est pas connecté.` },
      { status: 400 },
    );
  }

  const credentials = (integration.metadata as Record<string, string>) || {};
  const token = integration.access_token as string;
  const startedAt = new Date().toISOString();

  // ── Exécution EN ARRIÈRE-PLAN ──────────────────────────────────────────
  // after() tourne APRÈS l'envoi de la réponse : le client n'attend plus la fin
  // de l'import. On utilise le client service-role (les cookies de session ne
  // sont plus disponibles hors requête), scoping par organization_id conservé.
  after(async () => {
    const admin = createSupabaseAdminClient();
    let result;
    try {
      result = await connector({
        supabase: admin,
        orgId,
        provider,
        primaryToken: token,
        credentials,
      });
    } catch (err) {
      result = fail((err as Error).message);
    }
    await admin.from("sync_logs").insert({
      organization_id: orgId,
      source: provider,
      direction: "inbound",
      entity_type: provider,
      status: result.notImplemented ? "pending" : result.ok ? "completed" : "failed",
      entity_count: result.total,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      error_message: result.ok ? null : result.message,
    });
  });

  // Réponse immédiate : la sync est lancée, elle continue en arrière-plan.
  return NextResponse.json(
    {
      ok: true,
      background: true,
      message:
        "Synchronisation lancée. Elle continue en arrière-plan — les compteurs se mettent à jour dans quelques minutes (rafraîchis la page).",
    },
    { status: 202 },
  );
}
