import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import {
  isNameMatchEnabled, setNameMatchEnabled,
  isDomainMatchEnabled, setDomainMatchEnabled,
} from "@/lib/actions/engine";

export const dynamic = "force-dynamic";

/**
 * Signaux de rapprochement OPT-IN (nom, domaine). GET = états. POST { signal,
 * enabled } bascule ; en DÉSACTIVANT, purge les propositions EN ATTENTE de ce
 * signal pour que la file reflète immédiatement le choix.
 */
const SIG = { name: "name_match", domain: "shared_domain" } as const;
type SigKey = keyof typeof SIG;

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });
  const [name, domain] = await Promise.all([isNameMatchEnabled(supabase, orgId), isDomainMatchEnabled(supabase, orgId)]);
  return NextResponse.json({ name, domain });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { signal?: unknown; enabled?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const signal = body.signal as SigKey;
  if (signal !== "name" && signal !== "domain") return NextResponse.json({ error: "signal invalide" }, { status: 400 });
  const enabled = body.enabled === true;

  try {
    if (signal === "name") await setNameMatchEnabled(supabase, orgId, enabled);
    else await setDomainMatchEnabled(supabase, orgId, enabled);

    // Désactivation → purge des propositions EN ATTENTE de ce signal.
    if (!enabled) {
      await supabase
        .from("action_items")
        .delete()
        .eq("organization_id", orgId)
        .eq("source", "detector:declare_group")
        .eq("status", "pending")
        .eq("payload->>groupSignal", SIG[signal]);
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 500 });
  }
  return NextResponse.json({ signal, enabled });
}
