import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgId } from "@/lib/supabase/cached";
import { syncCustomConnector } from "@/lib/integrations/sync/connectors/custom-rest";
import type { CustomConnector, CustomEndpoint } from "@/lib/integrations/custom-connector";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Synchronisation immédiate d'un connecteur sur mesure (bouton « Synchroniser »). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data: connector } = await supabase
    .from("custom_connectors")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!connector) return NextResponse.json({ error: "Connecteur introuvable" }, { status: 404 });

  const { data: endpoints } = await supabase
    .from("custom_connector_endpoints")
    .select("*")
    .eq("connector_id", id)
    .eq("organization_id", orgId);
  if (!endpoints?.length) {
    return NextResponse.json({ error: "Aucun endpoint configuré — ajoute au moins les clients ou les factures." }, { status: 400 });
  }

  // Service role : l'écriture canonique (companies/invoices/source_links)
  // suit le même chemin que les connecteurs natifs.
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { counts, errors } = await syncCustomConnector(
    admin,
    connector as unknown as CustomConnector,
    endpoints as unknown as CustomEndpoint[],
  );

  await supabase
    .from("custom_connectors")
    .update({ last_sync_at: new Date().toISOString(), last_error: errors[0]?.slice(0, 500) ?? null })
    .eq("id", id)
    .eq("organization_id", orgId);

  // Journal de sync (même table que les connecteurs natifs).
  try {
    await admin.from("sync_logs").insert({
      organization_id: orgId,
      source: `custom_${connector.key}`,
      status: errors.length > 0 ? "partial" : "success",
      records_synced: Object.values(counts).reduce((s, n) => s + n, 0),
      started_at: new Date().toISOString(),
    });
  } catch { /* table absente → non bloquant */ }

  return NextResponse.json({ ok: true, counts, errors });
}
