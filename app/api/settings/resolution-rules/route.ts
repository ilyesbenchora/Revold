import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rules, configs } = await req.json() as {
    rules: Record<string, boolean>;
    configs: Record<string, Record<string, string>>;
  };

  const supabase = await createSupabaseServerClient();

  const rows = Object.entries(rules).map(([ruleId, enabled]) => ({
    organization_id: orgId,
    rule_id: ruleId,
    enabled,
    config: configs[ruleId] ?? {},
    updated_at: new Date().toISOString(),
  }));

  for (const row of rows) {
    await supabase.from("entity_resolution_config").upsert(row, {
      onConflict: "organization_id,rule_id",
    });
  }

  return NextResponse.json({ ok: true });
}
