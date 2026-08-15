import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { getToolKeys } from "@/lib/integrations/tool-mappings";
import { PaiementAgentChat } from "@/components/agents/paiement-agent-chat";
import { AgentProfileAvatar } from "@/components/agents/agent-profile-avatar";
import { SavedReportsCarousel } from "@/components/agents/saved-reports-carousel";
import { AgentPageShell } from "@/components/agents/agent-page-shell";
import { getAgent } from "@/lib/ai/agents/registry";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

export const dynamic = "force-dynamic";

// Page de la plateforme couverte par chaque agent — accessible depuis son chat.
const AGENT_PAGE: Record<string, { href: string; label: string }> = {
  performance: { href: "/dashboard/performances", label: "Performances" },
  // La page Alignement a été supprimée : ses KPIs (relais inter-services)
  // vivent en suggestions sur la page Trésorerie.
  "paiement-facturation": { href: "/dashboard/audit/paiement-facturation", label: "Trésorerie" },
  "service-client": { href: "/dashboard/audit/service-client", label: "Service Client" },
  proprietes: { href: "/dashboard/donnees", label: "Rapprochement données" },
};

/**
 * Anciens agents coachs → agent expert du même domaine. La famille « coachs »
 * est retirée du produit (doublon de domaines avec Mon équipe IA) ; sa
 * mécanique de séance vit désormais sur ces agents. Les anciens liens et
 * favoris continuent donc de fonctionner.
 */
const RETIRED_COACHES: Record<string, string> = {
  "coaching-ventes": "performance",
  "coaching-marketing": "performance",
  "coaching-data": "proprietes",
  "coaching-data-model": "paiement-facturation",
};

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentKey: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { agentKey } = await params;
  const sp = await searchParams;
  // Ancien lien vers un coach retiré → agent expert équivalent (ou, si cet
  // agent n'existe plus lui non plus, le hub Mon équipe IA).
  const successor = RETIRED_COACHES[agentKey];
  if (successor) {
    redirect(getAgent(successor) ? `/dashboard/agents/${successor}` : "/dashboard/audit");
  }
  const agent = getAgent(agentKey);
  if (!agent) notFound();

  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();
  const tools = orgId ? await getConnectedTools(supabase, orgId) : [];
  // Sélection explicite de Paramètres → « Outils sources par agent » : elle
  // fait foi quand elle existe ; sinon l'agent retombe sur tous les outils
  // connectés de son périmètre métier (sourceCategories).
  const agentToolKeys = orgId ? await getToolKeys(supabase, orgId, `agent_${agentKey}`) : [];
  const picked = agentToolKeys.length > 0
    ? tools.filter((t) => agentToolKeys.includes(t.key))
    : tools.filter((t) => agent.sourceCategories.includes(t.category));
  const sources = picked.map((t) => ({ key: t.key, label: t.label, icon: t.icon, category: t.category }));

  const persona = getAgentPersona(agent.key);

  // Deep-link d'onglet depuis les compteurs d'agent (?tab=history|suggestions|alerts|actions).
  const TABS = ["chat", "history", "alerts", "suggestions", "actions", "routines"] as const;
  // Tour de contrôle vocale (?ask=…) : la demande dictée est exécutée
  // automatiquement à l'ouverture du chat.
  const initialAsk = typeof sp.ask === "string" && sp.ask.trim() ? sp.ask.trim().slice(0, 600) : null;

  const initialTab = typeof sp.tab === "string" && (TABS as readonly string[]).includes(sp.tab)
    ? (sp.tab as (typeof TABS)[number])
    : undefined;

  // Shell client : dès qu'un rapport de routine existe, la page passe en
  // pleine largeur et le chat se replie pour laisser la place au rapport.
  const headerBlock = (
      <div className={`relative mb-4 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br ${persona.gradient} px-5 py-4`}>
        {/* Visage de l'agent en filigrane, discret et propre à cet agent */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={personaImagePath(agent.key)}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-10 h-40 w-40 select-none rounded-full object-cover opacity-[0.14]"
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AgentProfileAvatar name={persona.name} emoji={persona.emoji} image={personaImagePath(agent.key)} agentKey={agent.key} role={persona.role} pitch={persona.pitch} size={48} />
            <div>
              <div className="mb-0.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
                <span>✨</span> Agent · augmenté par l&apos;IA
              </div>
              <h1 className="text-xl font-semibold text-slate-900">
                {persona.name}, ton {persona.role.toLowerCase()}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">{agent.tagline}</p>
            </div>
          </div>
          {/* Accès direct à la page de la plateforme couverte par cet agent. */}
          {AGENT_PAGE[agent.key] && (
            <Link
              href={AGENT_PAGE[agent.key].href}
              className="shrink-0 rounded-lg border border-white/80 bg-white/70 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white hover:text-accent"
            >
              Page {AGENT_PAGE[agent.key].label} →
            </Link>
          )}
        </div>
      </div>
  );

  return (
    <AgentPageShell
      agentKey={agent.key}
      chatLabel={persona.name}
      header={headerBlock}
      chat={
        // Page d'agent = CHAT, point. Le cadrage de séance (objectifs, RDV)
        // vit dans Suivi → Séances : il n'a pas à s'intercaler devant la
        // conversation quand on ouvre un agent.
        <PaiementAgentChat
          agentKey={agent.key}
          agentLabel={agent.label}
          sources={sources}
          suggestions={agent.suggestions}
          suggestionSets={agent.suggestionSets ?? null}
          initialTab={initialTab}
          initialAsk={initialAsk}
          persona={{ name: persona.name, emoji: persona.emoji, image: personaImagePath(agent.key) }}
        />
      }
      reports={<SavedReportsCarousel agentKey={agent.key} />}
    />
  );
}
