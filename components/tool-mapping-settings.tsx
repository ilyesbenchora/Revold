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
  /** Sous-page : affichée indentée sous son parent ; hérite du mapping parent si vide. */
  parentKey?: string;
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
    hint: "Sélection multiple — Revold croise les outils choisis dans l'analyse de chaque page. Une sous-page sans sélection hérite du réglage de sa page parente.",
    pages: [
      { key: "audit_donnees", label: "Rapprochement données", description: "Qualité des données, audit d'onboarding des outils", mode: "multi" },
      { key: "audit_perf_ventes", label: "Performances — Ventes", description: "Pipeline, deals, closing, forecast", mode: "multi" },
      { key: "audit_perf_marketing", label: "Performances — Marketing", description: "Funnel d'acquisition, formulaires, campagnes", mode: "multi" },
      { key: "audit_perf_ads", label: "Performances — Publicité", description: "Ads : dépenses, CPC/CPL, ROAS, conversions par campagne", mode: "multi", parentKey: "audit_perf_marketing" },
      { key: "audit_appels", label: "Appels", description: "Phoning : volume, durée moyenne, taux de décroché", mode: "multi" },
      { key: "audit_paiement_facturation", label: "Trésorerie", description: "Invoices, subscriptions, quotes", mode: "multi" },
      { key: "audit_paiement_facturation_facturation", label: "Facturation", description: "Émission, relances, délais de paiement", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_paiement", label: "Paiement", description: "Encaissements, impayés, moyens de paiement", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_comptabilite", label: "Comptabilité", description: "Écritures, P&L réel, balance", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_paiement_facturation_previsionnel", label: "Prévisionnel", description: "Projection trésorerie, runway, échéances", mode: "multi", parentKey: "audit_paiement_facturation" },
      { key: "audit_service_client", label: "Service Client", description: "Tickets, conversations, satisfaction", mode: "multi" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    hint: "Sélection multiple — KPIs cross-outils dans la vue de pilotage.",
    pages: [
      { key: "dashboard", label: "Dashboard", description: "Vue d'ensemble & Mes rapports — KPIs en temps réel", mode: "multi" },
    ],
  },
  // Sources par AGENT (clés agent_<agentKey>) : chaque agent expert n'analyse
  // que les outils choisis ici. Sans sélection, l'agent retombe sur tous les
  // outils connectés de son périmètre par défaut.
  {
    id: "agents_equipe",
    title: "Agents — Mon équipe IA",
    hint: "Sélection multiple — chaque agent expert n'analyse que les outils choisis. Sans sélection, l'agent utilise tous les outils connectés de son périmètre.",
    pages: [
      { key: "agent_performance", label: "Agent Performances", description: "Pipeline, deals, closing, forecast", mode: "multi" },
      { key: "agent_paiement-facturation", label: "Agent Trésorerie", description: "Factures, encaissements, cash", mode: "multi" },
      { key: "agent_service-client", label: "Agent Service Client", description: "Tickets, conversations, satisfaction", mode: "multi" },
    ],
  },
];

/** Groupes de sections : "pages" = pages Revold · "agents" = agents. */
const AGENT_SECTION_IDS = new Set(["agents_equipe"]);

/**
 * Toutes les clés réglables ici — source unique pour la page Paramètres qui
 * précharge les mappings. Sans ça, une page ajoutée aux SECTIONS s'affichait
 * vide tant que sa clé n'était pas recopiée à la main côté serveur.
 */
export const MAPPING_PAGE_KEYS: string[] = SECTIONS.flatMap((s) => s.pages.map((p) => p.key));

export function ToolMappingSettings({
  options,
  initialMappings,
  only,
}: {
  options: ConnectedToolOption[];
  initialMappings: Record<string, string[]>;
  /** Restreint le rendu à un groupe de sections (bloc distinct dans la page). */
  only?: "pages" | "agents";
}) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Record<string, string[]>>(initialMappings);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

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

      {SECTIONS.filter((s) =>
        only === "agents" ? AGENT_SECTION_IDS.has(s.id) : only === "pages" ? !AGENT_SECTION_IDS.has(s.id) : true,
      ).map((section) => {
        const isCollapsed = collapsed[section.id] ?? false;
        return (
        <section key={section.id} className="card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection(section.id)}
            aria-expanded={!isCollapsed}
            className="flex w-full items-center gap-2 border-b border-card-border bg-slate-50 px-5 py-3 text-left transition hover:bg-slate-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`shrink-0 text-slate-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{section.hint}</p>
            </div>
          </button>
          {!isCollapsed && (
          <div className="divide-y divide-card-border">
            {section.pages.map((p) => {
              const current = mappings[p.key] ?? [];
              const isPending = pendingKey === p.key;
              const parent = p.parentKey
                ? section.pages.find((x) => x.key === p.parentKey)
                : undefined;
              const inheritsFromParent = Boolean(parent) && current.length === 0;
              return (
                <div
                  key={p.key}
                  className={`flex flex-wrap items-start justify-between gap-4 py-4 pr-5 ${parent ? "pl-10" : "px-5"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${parent ? "text-slate-700" : "text-slate-800"}`}>
                      {parent && <span className="mr-1 text-slate-400">↳</span>}
                      {p.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{p.description}</p>
                    <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
                      {p.mode === "multi" ? "Multi-sélection" : "1 outil"}
                    </span>
                    {inheritsFromParent && (
                      <span className="ml-1 mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
                        Hérite de {parent!.label}
                      </span>
                    )}
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
          )}
        </section>
        );
      })}
    </div>
  );
}
