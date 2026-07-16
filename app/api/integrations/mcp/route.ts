import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/** GET /api/integrations/mcp — liste les serveurs MCP de l'org. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const { data, error } = await supabase
    .from("mcp_servers")
    .select("id, name, url, is_active, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    // Table absente (migration non appliquée) → liste vide + flag.
    if (/mcp_servers/.test(error.message)) return NextResponse.json({ servers: [], migrationNeeded: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ servers: data ?? [] });
}

/** POST /api/integrations/mcp — ajoute un serveur MCP distant. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { name?: string; url?: string; auth_token?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  const url = (body.url ?? "").trim();
  if (!name || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "Nom requis et URL https valide." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("mcp_servers")
    .insert({
      organization_id: orgId,
      created_by: user.id,
      name: name.slice(0, 80),
      url: url.slice(0, 500),
      auth_token: body.auth_token ? String(body.auth_token).slice(0, 2000) : null,
      is_active: true,
    })
    .select("id, name, url, is_active, created_at")
    .single();
  if (error) {
    if (/mcp_servers/.test(error.message)) {
      return NextResponse.json({ error: "Table mcp_servers absente — applique la migration Supabase." }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, server: data });
}
