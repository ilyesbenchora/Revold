import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { resolveCohortAccessor } from "@/lib/ai/agents/tool-library";

export const dynamic = "force-dynamic";

/**
 * Travail téléphonique des deals — croisement deals ouverts × appels
 * (activities type call) sur une PÉRIODE choisie par l'utilisateur (même
 * barre de période que les tables de données). Renvoie les deux lectures :
 * deals bien travaillés (≥ 2 appels) et deals jamais appelés sur la période.
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

  // Deals OUVERTS avec contact primaire (le pont vers la téléphonie).
  type DealRow = { id: string; name: string | null; amount: number | null; contact_id: string | null; company_id: string | null; last_contacted_at: string | null; created_date: string | null };
  let deals: DealRow[] = [];
  let dealsSansContact = 0;
  try {
    const { data } = await supabase
      .from("deals")
      .select("id, name, amount, contact_id, company_id, last_contacted_at, created_date")
      .eq("organization_id", orgId)
      .eq("is_closed_won", false)
      .eq("is_closed_lost", false)
      .order("amount", { ascending: false, nullsFirst: false })
      .limit(400);
    const rows = (data ?? []) as DealRow[];
    dealsSansContact = rows.filter((d) => !d.contact_id).length;
    deals = rows.filter((d) => d.contact_id);
  } catch {
    return NextResponse.json({ worked: [], neverCalled: [], dealsSansContact: 0, totalLinked: 0 });
  }

  // ── Filtre COHORTE (mêmes cohortes enregistrées que partout) : la cohorte
  // vit sur l'entreprise ou le contact — les deals sont filtrés par jointure.
  if (cohortKey && cohortValue) {
    try {
      const acc = await resolveCohortAccessor(supabase, orgId, cohortKey);
      if (acc.prop || acc.col) {
        const table = acc.object === "contacts" ? "contacts" : "companies";
        const sel = acc.prop ? "id, raw_data" : `id, ${acc.col}`;
        const { data: rows } = await supabase.from(table).select(sel).eq("organization_id", orgId).limit(10000);
        const wanted = new Set<string>();
        for (const r of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
          const raw = acc.prop
            ? ((r.raw_data as { properties?: Record<string, unknown> } | null)?.properties?.[acc.prop] ?? null)
            : r[acc.col as string];
          if (raw != null && String(raw).trim() === cohortValue) wanted.add(String(r.id));
        }
        deals = deals.filter((d) =>
          acc.object === "contacts" ? (d.contact_id ? wanted.has(d.contact_id) : false) : d.company_id ? wanted.has(d.company_id) : false,
        );
      }
    } catch { /* cohorte inconnue → aucun filtre plutôt qu'un résultat faux ? Non : filtre vide */ }
  }

  // Appels de la PÉRIODE par contact : volume, dernier appel, temps en ligne.
  const agg = new Map<string, { n: number; last: number; minutes: number }>();
  try {
    const ids = [...new Set(deals.map((d) => d.contact_id!))];
    if (ids.length > 0) {
      let q = supabase
        .from("activities")
        .select("contact_id, occurred_at, duration_minutes")
        .eq("organization_id", orgId)
        .eq("type", "call")
        .in("contact_id", ids)
        .limit(8000);
      if (from) q = q.gte("occurred_at", from);
      if (to) q = q.lte("occurred_at", to);
      const { data } = await q;
      for (const c of (data ?? []) as Array<{ contact_id: string | null; occurred_at: string | null; duration_minutes: number | null }>) {
        if (!c.contact_id) continue;
        const t = c.occurred_at ? new Date(c.occurred_at).getTime() : 0;
        const cur = agg.get(c.contact_id) ?? { n: 0, last: 0, minutes: 0 };
        cur.n += 1;
        cur.minutes += Number(c.duration_minutes) || 0;
        if (t > cur.last) cur.last = t;
        agg.set(c.contact_id, cur);
      }
    }
  } catch { /* pas d'appels → listes en conséquence */ }

  // Noms des contacts (une requête pour les deux tables).
  const nameOf = new Map<string, string>();
  try {
    const involved = [...new Set(deals.map((d) => d.contact_id!))].slice(0, 400);
    const { data } = await supabase.from("contacts").select("id, full_name, email").in("id", involved);
    for (const c of (data ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
      nameOf.set(c.id, c.full_name?.trim() || c.email || "—");
    }
  } catch { /* noms absents → — */ }

  const enriched = deals.map((d) => ({
    id: d.id,
    name: d.name?.trim() || "Deal sans nom",
    amount: d.amount != null ? Math.round(Number(d.amount)) : null,
    contactName: nameOf.get(d.contact_id!) ?? "—",
    lastCrmAt: d.last_contacted_at,
    createdAt: d.created_date,
    calls: agg.get(d.contact_id!) ?? { n: 0, last: 0, minutes: 0 },
  }));

  return NextResponse.json({
    worked: enriched.filter((d) => d.calls.n >= 2).sort((a, b) => b.calls.n - a.calls.n).slice(0, 10),
    neverCalled: enriched.filter((d) => d.calls.n === 0 && (d.amount ?? 0) > 0).slice(0, 10),
    dealsSansContact,
    totalLinked: deals.length,
  });
}
