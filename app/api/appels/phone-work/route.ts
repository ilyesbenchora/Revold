import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

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

  // Deals OUVERTS avec contact primaire (le pont vers la téléphonie).
  type DealRow = { id: string; name: string | null; amount: number | null; contact_id: string | null; last_contacted_at: string | null; created_date: string | null };
  let deals: DealRow[] = [];
  let dealsSansContact = 0;
  try {
    const { data } = await supabase
      .from("deals")
      .select("id, name, amount, contact_id, last_contacted_at, created_date")
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
