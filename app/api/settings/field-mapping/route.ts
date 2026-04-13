import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { mappings } = await req.json() as {
    mappings: Array<{ provider: string; canonical_field: string; provider_field: string }>;
  };

  const supabase = await createSupabaseServerClient();

  for (const m of mappings) {
    await supabase.from("identifier_field_mapping").upsert({
      organization_id: orgId,
      provider: m.provider,
      canonical_field: m.canonical_field,
      provider_field: m.provider_field,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id,provider,canonical_field" });
  }

  return NextResponse.json({ ok: true });
}
