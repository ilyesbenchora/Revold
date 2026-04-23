export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getAuthUser } from "@/lib/supabase/cached";
import { setToolKeys, listConnectedTools } from "@/lib/integrations/tool-mappings";

export async function POST(req: NextRequest) {
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "no org" }, { status: 401 });

  const user = await getAuthUser();
  const body = await req.json().catch(() => null);
  const pageKey = (body?.pageKey as string | undefined)?.trim();
  const rawKeys = body?.toolKeys;
  const singleKey = (body?.toolKey as string | undefined)?.trim();

  // Accepte toolKeys: string[] OU toolKey: string (back-compat)
  let toolKeys: string[] = [];
  if (Array.isArray(rawKeys)) {
    toolKeys = rawKeys.filter((k): k is string => typeof k === "string" && k.length > 0);
  } else if (singleKey) {
    toolKeys = [singleKey];
  }

  if (!pageKey) {
    return NextResponse.json({ error: "pageKey required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const connected = await listConnectedTools(supabase, orgId);
  const connectedSet = new Set(connected.map((t) => t.key));

  // Filtre côté serveur : on n'enregistre que les outils RÉELLEMENT connectés
  const sanitized = toolKeys.filter((k) => connectedSet.has(k));

  await setToolKeys(supabase, orgId, pageKey, sanitized, user?.id ?? null);
  return NextResponse.json({ ok: true, toolKeys: sanitized });
}
