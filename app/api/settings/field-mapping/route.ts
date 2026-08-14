import { NextResponse } from "next/server";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const { mappings } = await req.json() as {
    mappings: Array<{ provider: string; canonical_field: string; provider_field: string; object_type?: string | null }>;
  };

  const supabase = await createSupabaseServerClient();
  const OBJECTS = new Set(["contacts", "companies", "deals"]);

  for (const m of mappings) {
    // Champ vidé côté formulaire → suppression du mapping (un upsert vide
    // laisserait un override mort que la sync continuerait de consommer).
    if (!m.provider_field?.trim()) {
      await supabase
        .from("identifier_field_mapping")
        .delete()
        .eq("organization_id", orgId)
        .eq("provider", m.provider)
        .eq("canonical_field", m.canonical_field);
      continue;
    }
    const base = {
      organization_id: orgId,
      provider: m.provider,
      canonical_field: m.canonical_field,
      provider_field: m.provider_field,
      updated_at: new Date().toISOString(),
    };
    // Objet CRM porteur du champ (contacts/companies/deals) — résilient si la
    // migration object_type n'est pas encore appliquée.
    const objectType = m.object_type && OBJECTS.has(m.object_type) ? m.object_type : null;
    const { error } = await supabase
      .from("identifier_field_mapping")
      .upsert({ ...base, object_type: objectType }, { onConflict: "organization_id,provider,canonical_field" });
    if (error && /object_type/.test(error.message)) {
      await supabase
        .from("identifier_field_mapping")
        .upsert(base, { onConflict: "organization_id,provider,canonical_field" });
    }
  }

  return NextResponse.json({ ok: true });
}
