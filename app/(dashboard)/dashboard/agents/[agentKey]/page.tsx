import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { type CoachAgendaInitial } from "@/components/agents/coach-agenda";
import { CoachingWorkspace } from "@/components/agents/coaching-workspace";
import { AgentProfileAvatar } from "@/components/agents/agent-profile-avatar";
import { SavedReportsCarousel } from "@/components/agents/saved-reports-carousel";
import { getAgent, COACHING_CATEGORY } from "@/lib/ai/agents/registry";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentKey } = await params;
  const sp = await searchParams;
  const agent = getAgent(agentKey);
  if (!agent) notFound();

  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const tools = orgId ? await getConnectedTools(supabase, orgId) : [];
  const sources = tools
    .filter((t) => agent.sourceCategories.includes(t.category))
    .map((t) => ({ key: t.key, label: t.label, icon: t.icon, category: t.category }));

  // Agents coach : charge l'agenda (objectifs/pains/RDV) de la catégorie.
  const coachingCategory = COACHING_CATEGORY[agentKey] ?? null;
  let agenda: CoachAgendaInitial | null = null;
  if (coachingCategory && orgId) {
    const first = await supabase
      .from("coaching_agendas")
      .select("objectives, pains, cadence, next_meeting_at, next_meeting_time, sources, attachments")
      .eq("organization_id", orgId)
      .eq("category", coachingCategory)
      .maybeSingle();
    let data: CoachAgendaInitial | null = (first.data as CoachAgendaInitial | null) ?? null;
    // Résilience : colonne next_meeting_time absente (migration non appliquée).
    if (first.error && /next_meeting_time/.test(first.error.message)) {
      const fb = await supabase
        .from("coaching_agendas")
        .select("objectives, pains, cadence, next_meeting_at, sources, attachments")
        .eq("organization_id", orgId)
        .eq("category", coachingCategory)
        .maybeSingle();
      data = (fb.data as CoachAgendaInitial | null) ?? null;
    }
    agenda = data ?? {};
  }

  // Coaching issu d'un rapport (?rc=…) : on récupère la donnée du rapport pour
  // contextualiser directement la séance — pas de RDV à créer.
  const rcId = typeof sp.rc === "string" ? sp.rc : null;
  let reportBrief: { objectives: string; pains: string } | null = null;
  if (rcId && orgId) {
    const { data } = await supabase
      .from("report_coachings")
      .select("title, body, recommendation, kpi_label")
      .eq("organization_id", orgId)
      .eq("id", rcId)
      .maybeSingle();
    if (data) {
      const brief = data as { title?: string; body?: string; recommendation?: string; kpi_label?: string };
      const objective = [brief.title, brief.body].filter(Boolean).join(" — ");
      const pains = [brief.recommendation, brief.kpi_label ? `KPI : ${brief.kpi_label}` : ""].filter(Boolean).join(" · ");
      reportBrief = { objectives: objective, pains };
    }
  }
  // Coaching lancé depuis une carte (?bt=titre&bp=reco) sans id de rapport.
  if (!reportBrief) {
    const bt = typeof sp.bt === "string" ? sp.bt : "";
    const bp = typeof sp.bp === "string" ? sp.bp : "";
    if (bt || bp) reportBrief = { objectives: bt, pains: bp };
  }

  const coachLabel = agent.label.replace(/^Coach\s+(des\s+)?/i, "");
  const persona = getAgentPersona(agent.key);

  // Deep-link d'onglet depuis les compteurs d'agent (?tab=history|suggestions|alerts|actions).
  const TABS = ["chat", "history", "alerts", "suggestions", "actions"] as const;
  const initialTab = typeof sp.tab === "string" && (TABS as readonly string[]).includes(sp.tab)
    ? (sp.tab as (typeof TABS)[number])
    : undefined;

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className={`relative mb-4 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br ${persona.gradient} px-5 py-4`}>
        {/* Visage de l'agent en filigrane, discret et propre à cet agent */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={personaImagePath(agent.key)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 h-40 w-40 select-none rounded-full object-cover opacity-[0.14]"
        />
        <div className="relative z-10 flex items-start gap-3">
          <AgentProfileAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(agent.key)} agentKey={agent.key} role={persona.role} pitch={persona.pitch} size={48} />
          <div>
            <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              <span>✨</span> {coachingCategory ? "Coach" : "Agent"} · augmenté par l&apos;IA
            </div>
            <h1 className="text-xl font-semibold text-slate-900">
              {persona.name}, ton {persona.role.toLowerCase()}
            </h1>
            <p className="mt-0.5 text-sm text-slate-600">{agent.tagline}</p>
          </div>
        </div>
      </div>

      {coachingCategory ? (
        <CoachingWorkspace
          category={coachingCategory}
          coachLabel={coachLabel}
          initialAgenda={agenda ?? {}}
          initialTab={initialTab}
          availableSources={sources}
          agentKey={agent.key}
          agentLabel={agent.label}
          sources={sources}
          suggestions={agent.suggestions}
          suggestionSets={agent.suggestionSets ?? null}
          reportBrief={reportBrief}
          persona={{ name: persona.name, emoji: persona.emoji, image: personaImagePath(agent.key) }}
        />
      ) : (
        <>
          <PaiementAgentChat
            agentKey={agent.key}
            agentLabel={agent.label}
            sources={sources}
            suggestions={agent.suggestions}
            suggestionSets={agent.suggestionSets ?? null}
            initialTab={initialTab}
            persona={{ name: persona.name, emoji: persona.emoji, image: personaImagePath(agent.key) }}
          />
          <SavedReportsCarousel agentKey={agent.key} />
        </>
      )}
    </div>
  );
}
