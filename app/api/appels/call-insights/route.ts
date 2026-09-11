import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveCohortAccessor } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

/**
 * Conversations à signaux — transcriptions Aircall AI dont les mots-clés
 * business ont été détectés (call_insights), recalculées sur la PÉRIODE et la
 * COHORTE choisies par l'utilisateur (même consultation que les tables de
 * données). Les compteurs d'honnêteté (transcrites / analysées) suivent les
 * mêmes filtres — jamais un ratio calculé sur un autre périmètre.
 */

const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const fromP = url.searchParams.get("from");
  const toP = url.searchParams.get("to");
  const from = !all && fromP && dateRe.test(fromP) ? `${fromP}T00:00:00Z` : null;
  const to = !all && toP && dateRe.test(toP) ? `${toP}T23:59:59Z` : null;
  const cohortKey = (url.searchParams.get("cohortKey") ?? "").trim() || null;
  const cohortValue = (url.searchParams.get("cohortValue") ?? "").trim() || null;

  type InsightRow = { id: string; contact_id: string | null; occurred_at: string | null; transcript_available: boolean; keywords: string[] | null; snippet: string | null };
  let rows: InsightRow[] = [];
  try {
    let q = supabase
      .from("call_insights")
      .select("id, contact_id, occurred_at, transcript_available, keywords, snippet")
      .eq("organization_id", orgId)
      .order("occurred_at", { ascending: false })
      .limit(500);
    if (from) q = q.gte("occurred_at", from);
    if (to) q = q.lte("occurred_at", to);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: "Table indisponible" }, { status: 400 });
    rows = (data ?? []) as InsightRow[];
  } catch {
    return NextResponse.json({ error: "Table indisponible" }, { status: 400 });
  }

  // Rattachement CRM des conversations (une requête) : nom du contact + son
  // entreprise (pont vers les cohortes « entreprises »).
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter((v): v is string => !!v))];
  const contactName = new Map<string, string>();
  const contactCompany = new Map<string, string>();
  if (contactIds.length > 0) {
    try {
      const { data } = await supabase.from("contacts").select("id, full_name, email, company_id").in("id", contactIds);
      for (const c of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null; company_id: string | null }>) {
        contactName.set(c.id, c.full_name?.trim() || c.email || "Contact");
        if (c.company_id) contactCompany.set(c.id, c.company_id);
      }
    } catch { /* noms absents → « Contact » */ }
  }

  // ── Filtre COHORTE (mêmes cohortes enregistrées que partout) : la cohorte
  // vit sur le contact ou l'entreprise — les conversations sans contact relié
  // ne sont pas croisables et sortent du périmètre quand une cohorte est active.
  if (cohortKey && cohortValue) {
    try {
      const acc = await resolveCohortAccessor(supabase, orgId, cohortKey);
      if (acc.prop || acc.col) {
        const table = acc.object === "contacts" ? "contacts" : "companies";
        const sel = acc.prop ? "id, raw_data" : `id, ${acc.col}`;
        const { data: crows } = await supabase.from(table).select(sel).eq("organization_id", orgId).limit(10000);
        const wanted = new Set<string>();
        for (const r of (crows ?? []) as unknown as Array<Record<string, unknown>>) {
          const raw = acc.prop
            ? ((r.raw_data as { properties?: Record<string, unknown> } | null)?.properties?.[acc.prop] ?? null)
            : r[acc.col as string];
          if (raw != null && String(raw).trim() === cohortValue) wanted.add(String(r.id));
        }
        rows = rows.filter((r) => {
          if (!r.contact_id) return false;
          if (acc.object === "contacts") return wanted.has(r.contact_id);
          const companyId = contactCompany.get(r.contact_id);
          return companyId ? wanted.has(companyId) : false;
        });
      }
    } catch { /* cohorte inconnue → périmètre vide plutôt qu'un résultat faux */ }
  }

  const transcriptsChecked = rows.length;
  const transcriptsAvailable = rows.filter((r) => r.transcript_available).length;
  const insights = rows
    .filter((r) => (r.keywords?.length ?? 0) > 0)
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      contactName: r.contact_id ? contactName.get(r.contact_id) ?? "Contact" : null,
      occurredAt: r.occurred_at,
      keywords: r.keywords ?? [],
      snippet: r.snippet,
    }));

  return NextResponse.json({ insights, transcriptsChecked, transcriptsAvailable });
}
