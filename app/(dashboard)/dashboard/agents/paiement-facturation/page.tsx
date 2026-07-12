import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { PAIEMENT_SUGGESTIONS } from "@/lib/ai/agents/paiement-facturation-agent";

export const dynamic = "force-dynamic";

export default async function AgentPaiementFacturationPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const tools = orgId ? await getConnectedTools(supabase, orgId) : [];
  // Sources pertinentes pour croiser l'analyse P&F : billing (facturation) + CRM.
  const sources = tools
    .filter((t) => t.category === "billing" || t.category === "crm")
    .map((t) => ({ key: t.key, label: t.label, icon: t.icon }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-100 via-fuchsia-100 to-amber-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
          <span>✨</span> Agent expert · POC
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Agent Paiement &amp; Facturation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyse conversationnelle et cross-source de ta performance financière. L&apos;agent interroge tes
          données réconciliées (Stripe, Pennylane, HubSpot…) et peut proposer des actions de suivi.
        </p>
      </div>

      <PaiementAgentChat sources={sources} suggestions={PAIEMENT_SUGGESTIONS} />
    </div>
  );
}
