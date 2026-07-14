import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { type CoachAgendaInitial } from "@/components/agents/coach-agenda";
import { CoachingWorkspace } from "@/components/agents/coaching-workspace";
import { getAgent, COACHING_CATEGORY } from "@/lib/ai/agents/registry";

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

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          <span>✨</span> {agent.label} · {coachingCategory ? "Coach" : "Agent expert"}
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{agent.label}</h1>
        <p className="mt-1 text-sm text-slate-500">{agent.tagline}</p>
      </div>

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
