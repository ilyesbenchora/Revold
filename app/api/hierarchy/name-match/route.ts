import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { isNameMatchEnabled, setNameMatchEnabled } from "@/lib/actions/engine";

export const dynamic = "force-dynamic";

/** Signal opt-in « rapprochement par nom ». GET = état, POST { enabled } = bascule. */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });
  return NextResponse.json({ enabled: await isNameMatchEnabled(supabase, orgId) });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  let body: { enabled?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Corps invalide" }, { status: 400 }); }
  const enabled = body.enabled === true;
  try {
    await setNameMatchEnabled(supabase, orgId, enabled);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Échec" }, { status: 500 });
  }
  return NextResponse.json({ enabled });
}
