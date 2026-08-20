import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rules, configs, order } = await req.json() as {
    rules: Record<string, boolean>;
    configs: Record<string, Record<string, string>>;
    /** Matrice de priorités : ids de règles dans l'ordre du matching. */
    order?: string[];
  };

  const supabase = await createSupabaseServerClient();

  // priority = position dans la matrice (le moteur trie dessus, repli sur le
  // rang canonique pour les règles sans priorité enregistrée).
  const priorityOf = new Map<string, number>(
    (Array.isArray(order) ? order.filter((id) => typeof id === "string") : []).map((id, i) => [id, i]),
  );

  const rows = Object.entries(rules).map(([ruleId, enabled]) => ({
    organization_id: orgId,
    rule_id: ruleId,
    enabled,
    config: configs[ruleId] ?? {},
    ...(priorityOf.has(ruleId) ? { priority: priorityOf.get(ruleId) } : {}),
    updated_at: new Date().toISOString(),
  }));

  for (const row of rows) {
    await supabase.from("entity_resolution_config").upsert(row, {
      onConflict: "organization_id,rule_id",
    });
  }

  return NextResponse.json({ ok: true });
}
