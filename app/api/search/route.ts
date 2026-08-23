import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { SEARCH_PAGES, normalizeSearch } from "@/lib/search/catalog";
import { AGENTS } from "@/lib/ai/agents/registry";
import { getAgentPersona } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";

/** Route de la page portant un rapport sauvegardé (préfixe de page_key). */
const REPORT_ROUTES: Array<{ prefix: string; href: string }> = [
  { prefix: "perf_ventes_risque", href: "/dashboard/performances/commerciale/deals-a-risque" },
  { prefix: "perf_ventes_expirees", href: "/dashboard/performances/commerciale/forecast-management" },
  { prefix: "perf_ventes", href: "/dashboard/performances/commerciale" },
  { prefix: "perf_marketing", href: "/dashboard/performances/marketing" },
  { prefix: "audit_service_client", href: "/dashboard/audit/service-client" },
  { prefix: "audit_paiement_facturation_facturation", href: "/dashboard/audit/paiement-facturation/facturation" },
  { prefix: "audit_paiement_facturation_paiement", href: "/dashboard/audit/paiement-facturation/paiement" },
  { prefix: "audit_paiement_facturation_comptabilite", href: "/dashboard/audit/paiement-facturation/comptabilite" },
  { prefix: "audit_paiement_facturation_previsionnel", href: "/dashboard/audit/paiement-facturation/previsionnel" },
  { prefix: "audit_paiement_facturation", href: "/dashboard/audit/paiement-facturation" },
  { prefix: "audit_donnees", href: "/dashboard/donnees" },
];
const reportHref = (pageKey: string, id: string) => {
  const r = REPORT_ROUTES.find((x) => pageKey === x.prefix || pageKey.startsWith(`${x.prefix}_`));
  return r ? `${r.href}#table-${id}` : `/dashboard/mes-rapports`;
};

export type SearchResult = { type: string; label: string; href: string; sub?: string };

/**
 * RECHERCHE GLOBALE (barre de la home) : pages de la plateforme, agents,
 * rapports sauvegardés, alertes, objectifs et tableaux de bord de l'org —
 * match insensible aux accents, groupes plafonnés (l'UI affiche par type).
 */
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId();
  if (!orgId) return NextResponse.json({ error: "Organisation introuvable" }, { status: 400 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const nq = normalizeSearch(q);
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const CAP = 5;

  const results: SearchResult[] = [];

  // ── Pages (catalogue statique) ──
  for (const p of SEARCH_PAGES) {
    if (normalizeSearch(`${p.label} ${p.keywords ?? ""}`).includes(nq)) {
      results.push({ type: "Pages", label: p.label, href: p.href });
      if (results.length >= CAP) break;
    }
  }

  // ── Agents (roster local) ──
  let agentCount = 0;
  for (const a of Object.values(AGENTS)) {
    const persona = getAgentPersona(a.key);
    if (normalizeSearch(`${a.label} ${persona.name} ${a.tagline}`).includes(nq)) {
      results.push({ type: "Agents", label: `${persona.name} — ${a.label}`, href: `/dashboard/agents/${a.key}` });
      if (++agentCount >= CAP) break;
    }
  }

  // ── Assets en base (chaque source résiliente : table absente → []) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grab = async (run: () => PromiseLike<{ data: unknown }>): Promise<any[]> => {
    try {
      const { data } = await run();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const [reports, alerts, objectives, boards] = await Promise.all([
    grab(() => supabase.from("page_data_tables").select("id, title, page_key").eq("organization_id", orgId).ilike("title", like).limit(CAP)),
    grab(() => supabase.from("alerts").select("id, title").eq("organization_id", orgId).ilike("title", like).limit(CAP)),
    grab(() => supabase.from("objectives").select("id, title").eq("organization_id", orgId).ilike("title", like).limit(CAP)),
    grab(() => supabase.from("custom_dashboards").select("id, name").eq("organization_id", orgId).ilike("name", like).limit(CAP)),
  ]);

  for (const r of reports) {
    results.push({ type: "Rapports", label: String(r.title), href: reportHref(String(r.page_key), String(r.id)) });
  }
  for (const a of alerts) {
    results.push({ type: "Alertes", label: String(a.title), href: `/dashboard/mes-alertes#alerte-${a.id}` });
  }
  for (const o of objectives) {
    results.push({ type: "Objectifs", label: String(o.title), href: "/dashboard/mes-alertes/objectifs" });
  }
  for (const b of boards) {
    results.push({ type: "Tableaux de bord", label: String(b.name), href: `/dashboard/tableaux-de-bord/${b.id}` });
  }

  return NextResponse.json({ results: results.slice(0, 25) });
}
