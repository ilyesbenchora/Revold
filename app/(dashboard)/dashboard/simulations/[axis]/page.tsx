import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { AgentProfileAvatar } from "@/components/agents/agent-profile-avatar";
import { SavedReportsCarousel } from "@/components/agents/saved-reports-carousel";
import { getAgent } from "@/lib/ai/agents/registry";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";

// Axe de prévision (slug) → clé d'agent.
const AXIS_AGENT: Record<string, string> = {
  marketing: "prev-marketing",
  revenue: "prev-revenue",
};

export default async function PrevisionAxisPage({ params }: { params: Promise<{ axis: string }> }) {
  const { axis } = await params;
  const agentKey = AXIS_AGENT[axis];
  if (!agentKey) notFound();
  const agent = getAgent(agentKey);
  if (!agent) notFound();

  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const tools = orgId ? await getConnectedTools(supabase, orgId) : [];
  const sources = tools
    .filter((t) => agent.sourceCategories.includes(t.category))
    .map((t) => ({ key: t.key, label: t.label, icon: t.icon, category: t.category }));

  const persona = getAgentPersona(agent.key);

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <Link href="/dashboard/simulations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        Prévisions
      </Link>

      <div className={`relative mb-4 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br ${persona.gradient} px-5 py-4`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={personaImagePath(agent.key)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 h-40 w-40 select-none rounded-full object-cover opacity-[0.14]"
        />
        <div className="relative z-10 flex items-start gap-3">
          <AgentProfileAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(agent.key)} role={persona.role} pitch={persona.pitch} size={48} />
          <div>
            <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
              <span>✨</span> Prévisionniste IA
            </div>
            <h1 className="text-xl font-semibold text-slate-900">{persona.name}, ton {persona.role.toLowerCase()}</h1>
            <p className="mt-0.5 text-sm text-slate-600">{agent.tagline}</p>
          </div>
        </div>
      </div>

      <PaiementAgentChat
        agentKey={agent.key}
        agentLabel={agent.label}
        sources={sources}
        suggestions={agent.suggestions}
        suggestionSets={agent.suggestionSets ?? null}
        persona={{ name: persona.name, emoji: persona.emoji, image: personaImagePath(agent.key) }}
      />

      <SavedReportsCarousel agentKey={agent.key} title="Prévisions enregistrées" />
    </div>
  );
}
