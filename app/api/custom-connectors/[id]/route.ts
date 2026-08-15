import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { customProvider } from "@/lib/integrations/custom-connector";

export const dynamic = "force-dynamic";

/** Supprime un connecteur sur mesure (config + intégration associée). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data: connector } = await supabase
    .from("custom_connectors")
    .select("key")
    .eq("id", id)
    .eq("organization_id", orgId)
    .maybeSingle();

  const { error } = await supabase.from("custom_connectors").delete().eq("id", id).eq("organization_id", orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (connector?.key) {
    await supabase
      .from("integrations")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", customProvider(connector.key as string));
  }
  return NextResponse.json({ ok: true });
}
