import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { frequencies } = await req.json() as { frequencies: Record<string, string> };
  const supabase = await createSupabaseServerClient();

  for (const [category, frequency] of Object.entries(frequencies)) {
    await supabase.from("sync_config").upsert({
      organization_id: orgId,
      category,
      frequency,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,category" });
  }

  return NextResponse.json({ ok: true });
}
