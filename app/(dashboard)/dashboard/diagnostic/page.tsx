export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";

/**
 * Page de DIAGNOSTIC HubSpot brut — accessible via /dashboard/diagnostic.
 *
 * Objectif : exposer les vraies réponses HubSpot pour qu'on puisse
 * débugger les "0 KPIs" en voyant exactement ce que ton portail renvoie.
 * Plus de devinettes — on lit les payloads réels.
 *
 * Endpoints testés (= ceux qui posent problème dans l'app) :
 *   - /crm/v3/pipelines/deals (liste pipelines)
 *   - /crm/v3/objects/deals/search filtré par chaque pipeline
 *   - /crm/v3/objects/{contacts|companies|deals}/search?limit=1 (counts)
 *   - /automation/v4/flows (workflows)
 *
 * Pour chaque appel, on affiche : status code HTTP, body brut (extrait),
 * + analyse rapide (count, IDs détectés, etc.).
 */

const HS = "https://api.hubapi.com";

type ProbeResult = {
  endpoint: string;
  method: string;
  status: number;
  ok: boolean;
  rawBody: string;
  analysis: string;
};

async function probe(
  token: string,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: unknown,
  analyzer?: (data: unknown) => string,
): Promise<ProbeResult> {
  try {
    const res = await fetch(`${HS}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = null;
    try { data = JSON.parse(text); } catch {}
    const analysis = data && analyzer ? analyzer(data) : (res.ok ? "OK (pas d'analyse)" : `HTTP ${res.status}`);
    return {
      endpoint,
      method,
      status: res.status,
      ok: res.ok,
      rawBody: text.slice(0, 1500),
      analysis,
    };
  } catch (err) {
    return {
      endpoint,
      method,
      status: 0,
      ok: false,
      rawBody: err instanceof Error ? err.message : String(err),
      analysis: "Erreur réseau",
    };
  }
}

export default async function DiagnosticPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);
  if (!token) {
    return (
      <p className="p-8 text-center text-sm text-slate-600">
        HubSpot non connecté. Allez dans Intégration pour brancher OAuth.
      </p>
    );
  }

  // 1) Pipelines deals
  const pipelinesProbe = await probe(token, "/crm/v3/pipelines/deals", "GET", undefined, (data) => {
    const d = data as { results?: Array<{ id?: string; pipelineId?: string; label?: string; stages?: unknown[] }> };
    const list = d.results ?? [];
    if (list.length === 0) return "0 pipeline retourné";
    return `${list.length} pipelines détectés : ${list.map((p) => `${p.label || "(sans label)"} [id=${p.id || p.pipelineId || "?"}]`).join(" | ")}`;
  });

  // 2) Pour chaque pipeline détecté, on compte les deals open avec le filter pipeline=X
  const pipelinesData = (pipelinesProbe.ok ? JSON.parse(pipelinesProbe.rawBody) : { results: [] }) as { results?: Array<{ id?: string; pipelineId?: string; label?: string }> };
  const dealsByPipeline: ProbeResult[] = await Promise.all(
    (pipelinesData.results ?? []).slice(0, 10).map((p) => {
      const pid = p.id || p.pipelineId || "";
      return probe(
        token,
        "/crm/v3/objects/deals/search",
        "POST",
        {
          filterGroups: [{
            filters: [
              { propertyName: "hs_is_closed", operator: "EQ", value: "false" },
              { propertyName: "pipeline", operator: "EQ", value: pid },
            ],
          }],
          limit: 1,
        },
        (data) => {
          const d = data as { total?: number };
          return `Deal open count pour pipeline "${p.label}" (id=${pid}) : ${d.total ?? "?"}`;
        },
      );
    }),
  );

  // 3) Counts globaux (ce que la Vue d'ensemble affiche)
  const [contactsProbe, companiesProbe, dealsProbe, ticketsProbe, formsProbeV3, formsProbeV2, listsProbe] =
    await Promise.all([
      probe(token, "/crm/v3/objects/contacts/search", "POST", { limit: 1 }, (d) => `total: ${(d as { total?: number }).total ?? "?"}`),
      probe(token, "/crm/v3/objects/companies/search", "POST", { limit: 1 }, (d) => `total: ${(d as { total?: number }).total ?? "?"}`),
      probe(token, "/crm/v3/objects/deals/search", "POST", { limit: 1 }, (d) => `total: ${(d as { total?: number }).total ?? "?"}`),
      probe(token, "/crm/v3/objects/tickets/search", "POST", { limit: 1 }, (d) => `total: ${(d as { total?: number }).total ?? "?"}`),
      probe(token, "/marketing/v3/forms?limit=1", "GET", undefined, (d) => `${((d as { results?: unknown[] }).results ?? []).length} forms (page 1)`),
      probe(token, "/forms/v2/forms?limit=1", "GET", undefined, (d) => `${(Array.isArray(d) ? d.length : ((d as { objects?: unknown[] }).objects ?? []).length)} forms (legacy v2)`),
      probe(token, "/crm/v3/lists/search", "POST", { count: 1, processingTypes: ["MANUAL", "DYNAMIC", "SNAPSHOT"] }, (d) => `total: ${(d as { total?: number }).total ?? "?"}`),
    ]);

  // 4) Workflows
  const [wfV3, wfV4] = await Promise.all([
    probe(token, "/automation/v3/workflows", "GET", undefined, (d) => `${((d as { workflows?: unknown[] }).workflows ?? []).length} workflows v3`),
    probe(token, "/automation/v4/flows?limit=10", "GET", undefined, (d) => `${((d as { results?: unknown[] }).results ?? []).length} flows v4`),
  ]);

  // 5) Snapshot status
  const snapshot = await getHubspotSnapshot();

  const probes: Array<{ section: string; results: ProbeResult[] }> = [
    { section: "1️⃣ Pipelines deals (source des onglets pipeline)", results: [pipelinesProbe] },
    { section: "2️⃣ Deals OUVERTS par pipeline (test du filter pipeline=X)", results: dealsByPipeline },
    { section: "3️⃣ Counts globaux (Contacts / Companies / Deals / Tickets)", results: [contactsProbe, companiesProbe, dealsProbe, ticketsProbe] },
    { section: "4️⃣ Forms (v3 → v2 fallback) + Lists", results: [formsProbeV3, formsProbeV2, listsProbe] },
    { section: "5️⃣ Workflows (v3 + v4)", results: [wfV3, wfV4] },
  ];

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">🔬 Diagnostic HubSpot</h1>
        <p className="mt-1 text-sm text-slate-500">
          Réponses brutes des endpoints HubSpot qui alimentent les KPIs de Revold.
          Si une donnée semble fausse dans l&apos;app, comparez ici la valeur réelle renvoyée par HubSpot.
        </p>
      </header>

      {/* Snapshot status */}
      <div className={`rounded-xl border p-4 ${
        snapshot.status === "ok" ? "border-emerald-200 bg-emerald-50/40"
        : snapshot.status === "no-token" ? "border-amber-200 bg-amber-50/40"
        : "border-rose-200 bg-rose-50/40"
      }`}>
        <p className="text-sm font-bold text-slate-900">
          Status snapshot : <span className={
            snapshot.status === "ok" ? "text-emerald-700"
            : snapshot.status === "no-token" ? "text-amber-700"
            : "text-rose-700"
          }>{snapshot.status}</span>
        </p>
        {snapshot.error && <p className="mt-1 text-xs text-rose-700">Erreur : {snapshot.error}</p>}
        <p className="mt-2 text-xs text-slate-600">
          Diagnostics par KPI : {Object.keys(snapshot.kpiDiagnostics ?? {}).length} entrées trackées.
        </p>
        {snapshot.kpiDiagnostics && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-accent">Voir le détail des status par KPI</summary>
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-white p-3 text-[11px] leading-relaxed text-slate-700">
              {JSON.stringify(snapshot.kpiDiagnostics, null, 2)}
            </pre>
          </details>
        )}
      </div>

      {probes.map((p) => (
        <div key={p.section} className="space-y-3">
          <h2 className="text-base font-bold text-slate-900">{p.section}</h2>
          {p.results.map((r, i) => (
            <article
              key={`${r.endpoint}-${i}`}
              className={`rounded-xl border p-4 ${r.ok ? "border-emerald-200 bg-emerald-50/30" : "border-rose-200 bg-rose-50/30"}`}
            >
              <div className="flex items-baseline justify-between gap-2 flex-wrap">
                <code className="text-xs font-mono text-slate-800">
                  {r.method} {r.endpoint}
                </code>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  r.ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                }`}>
                  HTTP {r.status}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-800">→ {r.analysis}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] font-medium text-accent">Voir le body brut HubSpot</summary>
                <pre className="mt-2 max-h-60 overflow-auto rounded bg-white p-3 text-[11px] leading-relaxed text-slate-700">
                  {r.rawBody}
                </pre>
              </details>
            </article>
          ))}
        </div>
      ))}

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 text-xs text-indigo-900">
        <p className="font-bold">💡 Comment utiliser cette page</p>
        <p className="mt-1">
          Si un KPI est à 0 dans l&apos;app, regardez ici si l&apos;endpoint correspondant renvoie
          réellement 0 (vraie donnée vide) ou si HubSpot répond en erreur (scope manquant, addon
          non activé, etc.). Copiez-collez l&apos;analyse + le body brut à votre dev pour qu&apos;il
          fixe la cause exacte sans deviner.
        </p>
      </div>
    </section>
  );
}
