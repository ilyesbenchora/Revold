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

import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getConnector } from "@/lib/integrations/sync/registry";
import { fail } from "@/lib/integrations/sync/types";

export const maxDuration = 60;

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

  // Load credentials
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

  // Run the connector
  let result;
  try {
    result = await connector({
      supabase,
      orgId,
      provider,
      primaryToken: integration.access_token,
      credentials,
    });
  } catch (err) {
    result = fail((err as Error).message);
  }

  // Log the sync
  await supabase.from("sync_logs").insert({
    organization_id: orgId,
    source: provider,
    direction: "inbound",
    entity_type: provider,
    status: result.notImplemented ? "pending" : result.ok ? "completed" : "failed",
    entity_count: result.total,
    started_at: result.ranAt,
    completed_at: new Date().toISOString(),
    error_message: result.ok ? null : result.message,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
