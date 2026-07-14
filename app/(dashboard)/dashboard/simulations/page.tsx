import { AgentSectionGrid } from "@/components/agents/agent-section-grid";

export const dynamic = "force-dynamic";

export default function SimulationsOverviewPage() {
  return (
    <AgentSectionGrid
      section="simulations"
      title="Prévisions"
      subtitle="Choisis un agent de prévisions pour projeter ta performance à partir de tes données historiques."
      classicHref="/dashboard/alertes"
      classicLabel="Simulations classiques"
    />
  );
}
