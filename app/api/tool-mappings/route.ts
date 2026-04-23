export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getAuthUser } from "@/lib/supabase/cached";
import { setToolMapping, listConnectedTools } from "@/lib/integrations/tool-mappings";

export async function POST(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "no org" }, { status: 401 });

  const user = await getAuthUser();
  const body = await req.json().catch(() => null);
  const pageKey = (body?.pageKey as string | undefined)?.trim();
  const toolKey = (body?.toolKey as string | undefined)?.trim();
  if (!pageKey || !toolKey) {
    return NextResponse.json({ error: "pageKey and toolKey required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Vérifie que l'outil est bien connecté (sinon on évite les choix fantômes)
  const connected = await listConnectedTools(supabase, orgId);
  if (!connected.find((t) => t.key === toolKey)) {
    return NextResponse.json({ error: "tool not connected" }, { status: 400 });
  }

  await setToolMapping(supabase, orgId, pageKey, toolKey, user?.id ?? null);
  return NextResponse.json({ ok: true });
}
