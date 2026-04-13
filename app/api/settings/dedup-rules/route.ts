import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { rules } = await req.json() as { rules: Record<string, boolean> };
  const supabase = await createSupabaseServerClient();

  for (const [ruleId, enabled] of Object.entries(rules)) {
    await supabase.from("entity_resolution_config").upsert({
      organization_id: orgId,
      rule_id: `dedup_${ruleId}`,
      enabled,
      config: {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,rule_id" });
  }

  return NextResponse.json({ ok: true });
}
