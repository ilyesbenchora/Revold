import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { authorities } = await req.json() as {
    authorities: Array<{ entity: string; field: string; priority: string[] }>;
  };

  const supabase = await createSupabaseServerClient();

  for (const a of authorities) {
    await supabase.from("field_authority_config").upsert({
      organization_id: orgId,
      entity: a.entity,
      field: a.field,
      priority: a.priority,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,entity,field" });
  }

  return NextResponse.json({ ok: true });
}
