import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getAgent } from "@/lib/ai/agents/registry";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";
import { AgentAvatar } from "./agent-avatar";
import { type CoachAgendaInitial } from "./coach-agenda";
import { CategoryAgendaBlock } from "./category-agenda-block";

/**
 * Section « Créer un rendez-vous & objectif » — cadrage AVANT la séance
 * (objectifs, points de douleur, cadence, prochain RDV), avec l'avatar de
 * l'agent en filigrane.
 *
 * Vaut pour n'importe quel agent de Mon équipe IA : la clé de l'agent sert de
 * clé de stockage de l'agenda.
 */
export async function CoachingAgendaSection({ agentKey }: { agentKey: string }) {
  const agent = getAgent(agentKey);
  if (!agent) return null;
  const category = agentKey;

  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  let agenda: CoachAgendaInitial = {};
  if (orgId) {
    const first = await supabase
      .from("coaching_agendas")
      .select("objectives, pains, cadence, next_meeting_at, next_meeting_time, sources, attachments")
      .eq("organization_id", orgId)
      .eq("category", category)
      .maybeSingle();
    let data: CoachAgendaInitial | null = (first.data as CoachAgendaInitial | null) ?? null;
    if (first.error && /next_meeting_time/.test(first.error.message)) {
      const fb = await supabase
        .from("coaching_agendas")
        .select("objectives, pains, cadence, next_meeting_at, sources, attachments")
        .eq("organization_id", orgId)
        .eq("category", category)
        .maybeSingle();
      data = (fb.data as CoachAgendaInitial | null) ?? null;
    }
    agenda = data ?? {};
  }

  const tools = orgId ? await getConnectedTools(supabase, orgId) : [];
  const availableSources = tools
    .filter((t) => agent.sourceCategories.includes(t.category))
    .map((t) => ({ key: t.key, label: t.label, icon: t.icon }));

  const coachLabel = agent.label.replace(/^Agent\s+/i, "");
  const persona = getAgentPersona(agentKey);

  return (
    <section className="mt-8 space-y-3">
      {/* En-tête : met en avant la séance personnalisée avec le bon agent */}
      <div className={`flex items-center gap-3 rounded-2xl border border-black/5 bg-gradient-to-br ${persona.gradient} px-4 py-3`}>
        <AgentAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(agentKey)} size={44} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">Séance de travail</p>
          <h2 className="text-base font-semibold text-slate-900">Cadrer un rendez-vous & objectif avec {persona.name}</h2>
          <p className="text-xs text-slate-500">{persona.name}, ton {persona.role.toLowerCase()} — {persona.pitch}</p>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={personaImagePath(agentKey)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 z-0 h-40 w-40 select-none rounded-full object-cover opacity-[0.12]"
        />
        <div className="relative z-10">
          <CategoryAgendaBlock
            category={category}
            coachLabel={coachLabel}
            agentKey={agentKey}
            initial={agenda}
            availableSources={availableSources}
          />
        </div>
      </div>
    </section>
  );
}
