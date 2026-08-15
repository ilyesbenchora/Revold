import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

export const dynamic = "force-dynamic";

/**
 * Historique de conversations d'un agent, par UTILISATEUR (multi-appareils).
 * Le client (chat) tient la liste complète en mémoire : la synchro est en
 * « full sync » — POST remplace l'ensemble des conversations de l'agent pour
 * cet utilisateur (upsert de chaque conversation + suppression des absentes).
 */

type ClientConversation = {
  id?: string;
  title?: string;
  updatedAt?: number;
  messages?: unknown[];
} & Record<string, unknown>;

const MAX_CONVERSATIONS = 60;
const MAX_PAYLOAD_CHARS = 200_000;

/** Liste les conversations de l'utilisateur pour un agent. */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const agentKey = new URL(request.url).searchParams.get("agent_key");
  if (!agentKey) return NextResponse.json({ error: "agent_key requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("agent_conversations")
    .select("client_id, payload, updated_at")
    .eq("user_id", user.id)
    .eq("agent_key", agentKey)
    .order("updated_at", { ascending: false })
    .limit(MAX_CONVERSATIONS);
  // Migration non appliquée → indisponible (le client garde son localStorage).
  if (error) return NextResponse.json({ conversations: [], unavailable: true });
  const conversations = (data ?? [])
    .map((r) => r.payload as ClientConversation)
    .filter((c) => c && typeof c === "object");
  return NextResponse.json({ conversations });
}

/** Full sync : remplace la liste de conversations de l'agent pour l'utilisateur. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { agentKey?: string; conversations?: ClientConversation[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const agentKey = typeof body.agentKey === "string" ? body.agentKey.slice(0, 80) : "";
  if (!agentKey) return NextResponse.json({ error: "agentKey requis" }, { status: 400 });

  const list = (Array.isArray(body.conversations) ? body.conversations : [])
    .filter((c) => c && typeof c === "object" && typeof c.id === "string" && c.id)
    .slice(0, MAX_CONVERSATIONS);

  const rows = list
    .map((c) => {
      // Garde-fou taille : une conversation monstrueuse est tronquée côté messages.
      let payload = c;
      try {
        if (JSON.stringify(c).length > MAX_PAYLOAD_CHARS && Array.isArray(c.messages)) {
          payload = { ...c, messages: c.messages.slice(-40) };
        }
      } catch { /* payload non sérialisable → ignoré plus bas */ }
      return {
        organization_id: orgId,
        user_id: user.id,
        agent_key: agentKey,
        client_id: String(c.id).slice(0, 80),
        title: typeof c.title === "string" ? c.title.slice(0, 300) : null,
        payload,
        updated_at: typeof c.updatedAt === "number" ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
      };
    });

  if (rows.length > 0) {
    const { error } = await supabase
      .from("agent_conversations")
      .upsert(rows, { onConflict: "user_id,agent_key,client_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Full sync : les conversations absentes de la liste envoyée sont supprimées.
  const keptIds = rows.map((r) => r.client_id);
  let del = supabase
    .from("agent_conversations")
    .delete()
    .eq("user_id", user.id)
    .eq("agent_key", agentKey);
  if (keptIds.length > 0) {
    del = del.not("client_id", "in", `(${keptIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`);
  }
  const { error: delError } = await del;
  if (delError) return NextResponse.json({ error: delError.message }, { status: 500 });

  return NextResponse.json({ ok: true, count: rows.length });
}
