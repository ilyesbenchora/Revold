import Link from "next/link";
import type { BlockedSimCategory } from "@/app/(dashboard)/dashboard/insights-ia/context";

const CATEGORY_LABEL: Record<BlockedSimCategory["category"], string> = {
  billing: "Facturation",
  support: "Service client",
  phone: "Téléphonie",
  conv_intel: "Conversation Intelligence",
};

const CATEGORY_TOOLS: Record<BlockedSimCategory["category"], string> = {
  billing: "Stripe / Pennylane / Sellsy / Axonaut / QuickBooks",
  support: "Intercom / Zendesk / Crisp / Freshdesk",
  phone: "Aircall / Ringover",
  conv_intel: "Praiz",
};

const TAB_LABEL: Record<string, string> = {
  revenue: "Revenue",
  cycle_ventes: "Cycle de ventes",
  marketing_cycle: "Marketing cycle",
  data_quality: "Données",
};

export function BlockedSimulationsNotice({ blocked }: { blocked: BlockedSimCategory[] }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-sm font-semibold text-amber-900">
        ⚠️ {blocked.reduce((sum, b) => sum + b.blockedCount, 0)} simulation
        {blocked.reduce((sum, b) => sum + b.blockedCount, 0) > 1 ? "s" : ""} masquée
        {blocked.reduce((sum, b) => sum + b.blockedCount, 0) > 1 ? "s" : ""} — données non disponibles
      </p>
      <p className="mt-1 text-xs text-amber-800">
        Aucune donnée n&apos;est inventée tant que les outils nécessaires ne sont pas connectés.
        Connectez les outils ci-dessous pour activer ces simulations.
      </p>

      <ul className="mt-3 space-y-2">
        {blocked.map((b) => (
          <li
            key={b.category}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/80 p-3 ring-1 ring-amber-200"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900">
                {b.blockedCount} simulation{b.blockedCount > 1 ? "s" : ""}{" "}
                <span className="text-slate-500">
                  ({b.affectedTabs.map((t) => TAB_LABEL[t] ?? t).join(", ")})
                </span>{" "}
                — Catégorie {CATEGORY_LABEL[b.category]} requise
              </p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                Outils compatibles : {CATEGORY_TOOLS[b.category]}
              </p>
            </div>
            <Link
              href="/dashboard/integration"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Connecter →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
