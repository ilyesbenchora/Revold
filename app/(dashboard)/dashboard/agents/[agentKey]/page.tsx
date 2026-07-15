import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { type CoachAgendaInitial } from "@/components/agents/coach-agenda";
import { CoachingWorkspace } from "@/components/agents/coaching-workspace";
import { getAgent, COACHING_CATEGORY } from "@/lib/ai/agents/registry";
import { getCoachPersona } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";

export default async function AgentPage({ params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
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
    const { data } = await supabase
      .from("coaching_agendas")
      .select("objectives, pains, cadence, next_meeting_at, sources, attachments")
      .eq("organization_id", orgId)
      .eq("category", coachingCategory)
      .maybeSingle();
    agenda = (data as CoachAgendaInitial | null) ?? {};
  }
  const coachLabel = agent.label.replace(/^Coach\s+(des\s+)?/i, "");
  const persona = getCoachPersona(coachingCategory);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      {coachingCategory ? (
        <div className={`relative mb-4 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br ${persona.gradient} px-5 py-4`}>
          {/* Silhouette humaine en filigrane, discrète et propre à ce coach */}
          <span aria-hidden className="pointer-events-none absolute -right-2 -bottom-5 select-none text-[6.5rem] leading-none opacity-[0.09]">
            {persona.emoji}
          </span>
          <div className="relative z-10 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-2xl shadow-sm ring-1 ring-black/5">
              {persona.emoji}
            </span>
            <div>
              <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <span>✨</span> Coach
              </div>
              <h1 className="text-xl font-semibold text-slate-900">{agent.label}</h1>
              <p className="mt-0.5 text-sm text-slate-600">{agent.tagline}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
            <span>✨</span> {agent.label} · Agent expert
          </div>
          <h1 className="text-xl font-semibold text-slate-900">{agent.label}</h1>
          <p className="mt-1 text-sm text-slate-500">{agent.tagline}</p>
        </div>
      )}

      {coachingCategory ? (
        <CoachingWorkspace
          category={coachingCategory}
          coachLabel={coachLabel}
          initialAgenda={agenda ?? {}}
          availableSources={sources}
          agentKey={agent.key}
          agentLabel={agent.label}
          sources={sources}
          suggestions={agent.suggestions}
          suggestionSets={agent.suggestionSets ?? null}
        />
      ) : (
        <PaiementAgentChat
          agentKey={agent.key}
          agentLabel={agent.label}
          sources={sources}
          suggestions={agent.suggestions}
          suggestionSets={agent.suggestionSets ?? null}
        />
      )}
    </div>
  );
}
