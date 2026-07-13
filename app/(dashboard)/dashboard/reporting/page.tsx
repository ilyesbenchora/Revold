import { AgentSectionGrid } from "@/components/agents/agent-section-grid";

export const dynamic = "force-dynamic";

export default function ReportingOverviewPage() {
  return (
    <AgentSectionGrid
      section="dashboard"
      title="Dashboard"
      subtitle="Construis tes rapports revenue multi-sources en conversationnel avec un agent expert."
      classicHref="/dashboard/rapports"
      classicLabel="Constructeur de rapports"
    />
  );
}
