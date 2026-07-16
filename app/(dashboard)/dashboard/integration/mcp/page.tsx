import Link from "next/link";
import { McpManager } from "@/components/integrations/mcp-manager";

export const dynamic = "force-dynamic";

export default function McpPage() {
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard/integration" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Retour aux intégrations
      </Link>

      <div>
        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-100">
          <span>🧩</span> POC · Connecteur MCP
        </div>
        <h1 className="text-2xl font-semibold text-slate-900">Serveurs MCP</h1>
        <p className="mt-1 text-sm text-slate-500">
          Connecte des serveurs MCP distants : leurs outils sont exposés aux agents Revold (lecture et actions live), <strong>en
          complément</strong> des données croisées via API. La couche de réconciliation cross-source (CRM × facturation × pub ×
          support) reste assurée par Revold.
        </p>
      </div>

      <McpManager />
    </section>
  );
}
