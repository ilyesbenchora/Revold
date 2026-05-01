"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "./brand-logo";
import type { ConnectedToolOption } from "@/lib/integrations/tool-mappings";

export type PageMappingDef = {
  key: string;
  label: string;
  description: string;
  mode: "single" | "multi";
};

type Section = {
  id: string;
  title: string;
  hint: string;
  pages: PageMappingDef[];
};

const SECTIONS: Section[] = [
  {
    id: "audit",
    title: "Données",
    hint: "1 outil principal d'analyse par page (sauf Vue d'ensemble).",
    pages: [
      { key: "audit_donnees", label: "Propriétés", description: "Qualité base CRM (contacts, entreprises, deals)", mode: "single" },
      { key: "audit_automatisations", label: "Automatisations", description: "Workflows et règles d'automatisation", mode: "single" },
      { key: "audit_perf_ventes", label: "Performances Ventes", description: "Pipeline, deals, closing, forecast", mode: "single" },
      { key: "audit_perf_marketing", label: "Performances Marketing", description: "Funnel d'acquisition, formulaires, campagnes", mode: "single" },
      { key: "audit_paiement_facturation", label: "Paiement & Facturation", description: "Invoices, subscriptions, quotes", mode: "single" },
      { key: "audit_service_client", label: "Service Client", description: "Tickets, conversations, satisfaction", mode: "single" },
      { key: "audit_adoption", label: "Adoption", description: "Owners, équipes, discipline d'usage", mode: "single" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    hint: "Sélection multiple — KPIs cross-outils dans la vue de pilotage.",
    pages: [
      { key: "dashboard", label: "Dashboard", description: "Mes rapports — KPIs en temps réel", mode: "multi" },
    ],
  },
  {
    id: "simulation",
    title: "Simulations IA",
    hint: "Sélection multiple — les simulations peuvent croiser plusieurs outils.",
    pages: [
      { key: "simulation_ia", label: "Simulations IA", description: "Cycle de vente, revenue, data quality", mode: "multi" },
    ],
  },
  {
    id: "coaching",
    title: "Coaching IA",
    hint: "Sélection multiple — l'IA peut combiner les insights de plusieurs outils.",
    pages: [
      { key: "coaching_ia", label: "Coaching IA", description: "Insights Ventes / Marketing / Data / Intégrations", mode: "multi" },
    ],
  },
];

export function ToolMappingSettings({
  options,
  initialMappings,
}: {
  options: ConnectedToolOption[];
  initialMappings: Record<string, string[]>;
}) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Record<string, string[]>>(initialMappings);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-600">
          Aucun outil connecté à Revold pour le moment.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Connectez un outil depuis la section Intégrations ci-dessus pour pouvoir
          configurer le mapping par page.
        </p>
      </div>
    );
  }

  function persist(pageKey: string, nextKeys: string[]) {
    setPendingKey(pageKey);
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/tool-mappings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageKey, toolKeys: nextKeys }),
        });
        if (!res.ok) {
          setError("Impossible d'enregistrer le choix.");
          setPendingKey(null);
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { toolKeys?: string[] };
        setMappings((m) => ({ ...m, [pageKey]: data.toolKeys ?? nextKeys }));
        setPendingKey(null);
        router.refresh();
      } catch {
        setError("Erreur réseau.");
        setPendingKey(null);
      }
    });
  }

  function setSingle(pageKey: string, toolKey: string) {
    persist(pageKey, [toolKey]);
  }

  function toggleMulti(pageKey: string, toolKey: string) {
    const current = mappings[pageKey] ?? [];
    const next = current.includes(toolKey)
      ? current.filter((k) => k !== toolKey)
      : [...current, toolKey];
    persist(pageKey, next);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}

      {SECTIONS.map((section) => (
        <section key={section.id} className="card overflow-hidden">
          <header className="border-b border-card-border bg-slate-50 px-5 py-3">
            <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{section.hint}</p>
          </header>
          <div className="divide-y divide-card-border">
            {section.pages.map((p) => {
              const current = mappings[p.key] ?? [];
              const isPending = pendingKey === p.key;
              return (
                <div
                  key={p.key}
                  className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{p.label}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{p.description}</p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      {p.mode === "multi" ? "Multi-sélection" : "1 outil"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {options.map((opt) => {
                      const isActive = current.includes(opt.key);
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            p.mode === "single"
                              ? setSingle(p.key, opt.key)
                              : toggleMulti(p.key, opt.key)
                          }
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            isActive
                              ? "border-accent bg-accent/10 text-accent"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          } disabled:opacity-50`}
                        >
                          <BrandLogo
                            domain={opt.domain}
                            alt={opt.label}
                            fallback={opt.icon}
                            size={14}
                          />
                          {opt.label}
                          {isActive && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                    {isPending && (
                      <span className="text-[11px] text-slate-400">Enregistrement…</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
