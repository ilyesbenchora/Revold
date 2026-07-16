import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";

export const dynamic = "force-dynamic";

/** GET /api/integrations/connected — outils réellement connectés (pour les sélecteurs client). */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ tools: [] });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ tools: [] });

  const tools = await getConnectedTools(supabase, orgId);
  return NextResponse.json({
    tools: tools.map((t) => ({ key: t.key, label: t.label, icon: t.icon, category: t.category })),
  });
}
