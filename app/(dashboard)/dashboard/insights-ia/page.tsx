export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { DismissedCoachingCarousel } from "@/components/dismissed-coaching-carousel";
import { getConnectedTools, connectedCategoriesSet } from "@/lib/integrations/connected-tools";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { AgentProfileAvatar } from "@/components/agents/agent-profile-avatar";
import { AgentInsightsCounts } from "@/components/agents/agent-insights-counts";
import {
  buildContext,
  fetchDismissals,
  fetchIntegrationInsights,
  fetchCrossSourceInsights,
  fetchDataModelInsights,
  fetchTrackingStats,
  selectInsights,
} from "./context";

type SeverityCounts = { critical: number; warning: number; info: number };

function countSeverities(items: Array<{ severity: string }>): SeverityCounts {
  let critical = 0, warning = 0, info = 0;
  for (const i of items) {
    if (i.severity === "critical") critical++;
    else if (i.severity === "warning") warning++;
    else info++;
  }
  return { critical, warning, info };
}

const CAT_LABELS: Record<string, string> = {
  commercial: "Ventes",
  marketing: "Marketing",
  data: "Data",
  integration: "Intégration",
  "cross-source": "Cross-source",
  "data-model": "Modèle de données",
};
function catLabel(c: string): string {
  return CAT_LABELS[c] ?? c;
}

const CADENCE_LABELS: Record<string, string> = {
  once: "Une seule fois",
  weekly: "Hebdomadaire",
  biweekly: "Toutes les 2 semaines",
  monthly: "Mensuel",
  quarterly: "Trimestriel",
};
function fmtPlannedDate(d: string): string {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
}
// Catégorie (id ou variante carousel) → clé d'agent coach, pour le lien « Reprendre ».
const CAT_AGENT: Record<string, string> = {
  commercial: "coaching-ventes",
  marketing: "coaching-marketing",
  data: "coaching-data",
  integration: "coaching-integration",
  "cross-source": "coaching-cross-source",
  cross_source: "coaching-cross-source",
  "data-model": "coaching-data-model",
  data_model: "coaching-data-model",
};
function sevBadge(s: string): string {
  if (s === "critical") return "bg-red-50 text-red-700";
  if (s === "warning") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}
function sevLabel(s: string): string {
  if (s === "critical") return "Critique";
  if (s === "warning") return "Vigilance";
  return "Info";
}

export default async function MesCoachingPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const token = await getHubSpotToken(supabase, orgId);

  const [ctx, { dismissedKeys }, { detectedIntegrations, integrationInsights }, connectedTools] = await Promise.all([
    buildContext(supabase, orgId),
    fetchDismissals(supabase, orgId),
    fetchIntegrationInsights(token),
    getConnectedTools(supabase, orgId),
  ]);
  const connectedCats = connectedCategoriesSet(connectedTools);

  const tracking = await fetchTrackingStats(token);
  ctx.trackingSample = tracking.trackingSample;
  ctx.onlineContacts = tracking.onlineContacts;

  const insightsByCategory = selectInsights(ctx, dismissedKeys);
  const visibleIntegrationInsights = integrationInsights.filter((i) => !dismissedKeys.has(i.key));
  const crossSourceInsights = await fetchCrossSourceInsights(supabase, orgId, dismissedKeys, connectedCats);
  const dataModelInsights = await fetchDataModelInsights(supabase, orgId, detectedIntegrations, ctx, dismissedKeys);

  // Coachings planifiés : RDV dont la date + heure sont strictement dans le futur.
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMs = now.getTime();
  const plannedFirst = await supabase
    .from("coaching_agendas")
    .select("category, objectives, cadence, next_meeting_at, next_meeting_time")
    .eq("organization_id", orgId)
    .gte("next_meeting_at", todayStr)
    .order("next_meeting_at", { ascending: true });
  let plannedRaw: unknown[] | null = plannedFirst.data;
  if (plannedFirst.error && /next_meeting_time/.test(plannedFirst.error.message)) {
    const fb = await supabase
      .from("coaching_agendas")
      .select("category, objectives, cadence, next_meeting_at")
      .eq("organization_id", orgId)
      .gte("next_meeting_at", todayStr)
      .order("next_meeting_at", { ascending: true });
    plannedRaw = fb.data;
  }
  const plannedCoachings = ((plannedRaw ?? []) as {
    category: string;
    objectives: string | null;
    cadence: string | null;
    next_meeting_at: string;
    next_meeting_time: string | null;
  }[]).filter((p) => {
    const t = p.next_meeting_time && /^\d{2}:\d{2}$/.test(p.next_meeting_time) ? p.next_meeting_time : "09:00";
    return new Date(`${p.next_meeting_at}T${t}:00`).getTime() > nowMs;
  });

  const categories = [
    { id: "commercial", agentKey: "coaching-ventes", label: "Coach des ventes", description: "Deals, pipeline, closing, workflows", sev: countSeverities(insightsByCategory.commercial),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { id: "marketing", agentKey: "coaching-marketing", label: "Coach marketing", description: "Leads, conversion, sources, acquisition", sev: countSeverities(insightsByCategory.marketing),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
    { id: "data", agentKey: "coaching-data", label: "Coach data", description: "Qualité et enrichissement des données", sev: countSeverities(insightsByCategory.data),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" /><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" /></svg> },
    { id: "integration", agentKey: "coaching-integration", label: "Coach intégration", description: "Adoption outils et rapports suggérés", sev: countSeverities(visibleIntegrationInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" /></svg> },
    { id: "cross-source", agentKey: "coaching-cross-source", label: "Coach cross-source", description: "Insights multi-sources", sev: countSeverities(crossSourceInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.59 13.51l6.83 3.98" /><path d="M15.41 6.51l-6.82 3.98" /></svg> },
    { id: "data-model", agentKey: "coaching-data-model", label: "Coach finance", description: "Trésorerie, comptabilité et pilotage du cash", sev: countSeverities(dataModelInsights),
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
  ];

  // Fetch realized/removed insights with full snapshot
  const { data: allDismissals } = await supabase
    .from("insight_dismissals")
    .select("*")
    .eq("organization_id", orgId)
    .order("dismissed_at", { ascending: false });

  type Dismissal = {
    id: string;
    template_key: string;
    status?: string;
    title?: string;
    body?: string;
    recommendation?: string;
    severity?: string;
    category?: string;
    hubspot_url?: string;
    dismissed_at: string;
    agentKey?: string;
  };
  const dismissalsList = (allDismissals ?? []) as Dismissal[];
  const dismissedDone = dismissalsList
    .filter((d) => !d.status || d.status === "done")
    .map((d) => ({ ...d, agentKey: CAT_AGENT[d.category ?? ""] }));

  // Séances de coaching clôturées par un agent coach (terminées manuellement
  // ou automatiquement après inactivité).
  const { data: sessionsRaw } = await supabase
    .from("coaching_sessions")
    .select("id, category, ended_at, auto")
    .eq("organization_id", orgId)
    .order("ended_at", { ascending: false })
    .limit(60);
  const carouselCat: Record<string, string> = {
    commercial: "commercial",
    marketing: "marketing",
    data: "data",
    integration: "integration",
    "cross-source": "cross_source",
    "data-model": "data_model",
  };
  const sessionInsights: Dismissal[] = (sessionsRaw ?? []).map(
    (s: { id: string; category: string; ended_at: string; auto: boolean }) => ({
      id: `session-${s.id}`,
      template_key: "coaching_session",
      status: "done",
      title: `Séance de coaching ${catLabel(s.category)}`,
      body: s.auto
        ? "Séance clôturée automatiquement après inactivité."
        : "Séance de coaching menée avec l'agent et clôturée.",
      severity: "info",
      category: carouselCat[s.category] ?? s.category,
      dismissed_at: s.ended_at,
      agentKey: CAT_AGENT[s.category],
    }),
  );

  const doneInsights = [...sessionInsights, ...dismissedDone].sort(
    (a, b) => new Date(b.dismissed_at).getTime() - new Date(a.dismissed_at).getTime(),
  );

  // Mes coachings IA (activés depuis les rapports) — toutes catégories, actifs.
  const { data: manualCoachingsRaw } = await supabase
    .from("report_coachings")
    .select("id, category, title, body, recommendation, severity, kpi_label, created_at")
    .eq("organization_id", orgId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  const myCoachings = (manualCoachingsRaw ?? []) as {
    id: string;
    category: string;
    title: string;
    body: string;
    recommendation: string | null;
    severity: string;
    kpi_label: string | null;
    created_at: string;
  }[];
  const catToAgent: Record<string, string> = Object.fromEntries(categories.map((c) => [c.id, c.agentKey]));

  return (
    <div className="space-y-8">
      {/* Agents de coaching — en tête de section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-slate-900">Agents de coaching</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const persona = getAgentPersona(cat.agentKey);
            return (
              <Link key={cat.id} href={`/dashboard/agents/${cat.agentKey}`}
                className={`card group relative flex items-start gap-3 overflow-hidden bg-gradient-to-br ${persona.gradient} p-4 transition hover:border-accent/30 hover:shadow-md`}>
                {/* Visage du coach en filigrane — discret, différent par coach */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={personaImagePath(cat.agentKey)}
                  alt=""
                  aria-hidden
                  className="pointer-events-none absolute -right-4 -bottom-6 h-28 w-28 select-none rounded-full object-cover opacity-[0.1] transition group-hover:opacity-[0.2]"
                />
                <AgentProfileAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(cat.agentKey)} agentKey={cat.agentKey} role={persona.role} pitch={persona.pitch} size={38} className="mt-0.5" />
                <div className="relative z-10 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-slate-400">✨ {persona.name} · Coach IA</p>
                      <h3 className="truncate text-sm font-semibold text-slate-900 group-hover:text-accent transition">{cat.label}</h3>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 group-hover:text-accent transition"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{cat.description}</p>
                  <div className="mt-2">
                    <AgentInsightsCounts agentKey={cat.agentKey} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mes coachings IA — toutes catégories, activés depuis les rapports */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <span>✨</span> Mes coachings IA
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{myCoachings.length}</span>
        </h2>
        {myCoachings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">
              Aucun coaching IA activé pour l&apos;instant. Active-en depuis tes rapports ou tes agents.
            </p>
          </div>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scroll-smooth">
            {myCoachings.map((m) => (
              <div key={m.id} className="card snap-start shrink-0 p-4" style={{ width: "min(360px, 88vw)" }}>
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${sevBadge(m.severity)}`}>
                    {sevLabel(m.severity)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {catLabel(m.category)}
                  </span>
                  {/* Source : ces coachings proviennent des rapports (data existante) */}
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">
                    📊 Depuis un rapport
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{m.title}</h3>
                <p className="mt-1 line-clamp-3 text-xs text-slate-600">{m.recommendation || m.body}</p>
                {m.kpi_label && <p className="mt-2 text-[11px] text-slate-400">KPI : {m.kpi_label}</p>}
                <div className="mt-3">
                  {/* Pas de RDV à créer : la data du rapport contextualise directement le coaching. */}
                  <Link
                    href={`/dashboard/agents/${catToAgent[m.category] ?? "coaching-ventes"}?rc=${m.id}`}
                    className="inline-flex rounded-lg bg-accent px-3 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                  >
                    Faire mon coaching →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coaching prévu — RDV planifiés à une date ultérieure */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fuchsia-500"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
          Coaching prévu
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{plannedCoachings.length}</span>
        </h2>
        {plannedCoachings.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">Aucun coaching planifié. Prends un rendez-vous depuis un agent coach.</p>
          </div>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 scroll-smooth">
            {plannedCoachings.map((p) => (
              <div
                key={`${p.category}-${p.next_meeting_at}`}
                className="card snap-start shrink-0 border-l-4 border-l-fuchsia-400 p-4"
                style={{ width: "min(340px, 88vw)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                    {catLabel(p.category)}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {CADENCE_LABELS[p.cadence ?? ""] ?? "Mensuel"}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
                  {fmtPlannedDate(p.next_meeting_at)}{p.next_meeting_time ? ` à ${p.next_meeting_time}` : ""}
                </p>
                {p.objectives ? (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600">🎯 {p.objectives}</p>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Objectifs à définir</p>
                )}
                <Link
                  href={`/dashboard/agents/${catToAgent[p.category] ?? "coaching-ventes"}`}
                  className="mt-3 inline-flex rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-indigo-500"
                >
                  Voir le coaching →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Coaching réalisé — horizontal carousel */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          Coaching réalisé par les agents
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{doneInsights.length}</span>
        </h2>
        {doneInsights.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm text-slate-500">Aucun coaching réalisé pour le moment.</p>
          </div>
        ) : (
          <DismissedCoachingCarousel items={doneInsights} variant="done" />
        )}
      </div>

    </div>
  );
}
