import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { getAgent } from "@/lib/ai/agents/registry";

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
    .map((t) => ({ key: t.key, label: t.label, icon: t.icon }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          <span>✨</span> {agent.label} · Agent expert
        </div>
        <h1 className="text-xl font-semibold text-slate-900">{agent.label}</h1>
        <p className="mt-1 text-sm text-slate-500">{agent.tagline}</p>
      </div>

      <PaiementAgentChat
        agentKey={agent.key}
        agentLabel={agent.label}
        sources={sources}
        suggestions={agent.suggestions}
      />
    </div>
  );
}
