"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isChildVisible, type WorkspaceId } from "@/lib/workspaces";

/**
 * Paramètres → Utilisateurs & équipes : matrice d'accès PAR PAGE et PAR ÉQUIPE
 * (espace de travail), sur trois droits — Visualisation, Modification,
 * Création. Même esprit que « Outil source par page » : chaque changement est
 * enregistré immédiatement (table page_access).
 *
 * Sans réglage enregistré, une page suit l'accès par défaut de l'espace
 * (WORKSPACE_NAV) — la matrice affiche cet état par défaut. La Visualisation
 * pilote la navigation (sidebar) ; Modification et Création sont stockées et
 * appliquées aux flux d'édition/création des pages.
 */

const TEAMS: { id: Exclude<WorkspaceId, "all">; label: string; icon: string }[] = [
  { id: "sales", label: "Ventes", icon: "💼" },
  { id: "marketing", label: "Marketing", icon: "📣" },
  { id: "cs", label: "Service client", icon: "🤝" },
  { id: "finance", label: "Comptabilité", icon: "💳" },
];

const RIGHTS: { id: "view" | "edit" | "create"; label: string; icon: string }[] = [
  { id: "view", label: "Visualisation", icon: "👁" },
  { id: "edit", label: "Modification", icon: "✏️" },
  { id: "create", label: "Création", icon: "＋" },
];

type PageRow = {
  href: string;
  label: string;
  /** Sous-page : indentée sous son parent, défaut hérité du parent. */
  indent?: boolean;
  /** href dont hériter l'accès par défaut (parent de la sous-page). */
  defaultFrom?: string;
};
type Section = { id: string; title: string; pages: PageRow[] };

const SECTIONS: Section[] = [
  {
    id: "audit",
    title: "Données",
    pages: [
      { href: "/dashboard/audit", label: "Mon équipe IA" },
      { href: "/dashboard/performances", label: "Performances" },
      { href: "/dashboard/performances/commerciale", label: "Ventes", indent: true, defaultFrom: "/dashboard/performances" },
      { href: "/dashboard/performances/marketing", label: "Marketing", indent: true, defaultFrom: "/dashboard/performances" },
      { href: "/dashboard/performances/marketing/publicite", label: "Publicité", indent: true, defaultFrom: "/dashboard/performances" },
      { href: "/dashboard/appels", label: "Appels" },
      { href: "/dashboard/audit/paiement-facturation", label: "Trésorerie" },
      { href: "/dashboard/audit/paiement-facturation/facturation", label: "Facturation", indent: true, defaultFrom: "/dashboard/audit/paiement-facturation" },
      { href: "/dashboard/audit/paiement-facturation/paiement", label: "Paiement", indent: true, defaultFrom: "/dashboard/audit/paiement-facturation" },
      { href: "/dashboard/audit/paiement-facturation/comptabilite", label: "Comptabilité", indent: true, defaultFrom: "/dashboard/audit/paiement-facturation" },
      { href: "/dashboard/audit/paiement-facturation/previsionnel", label: "Prévisionnel", indent: true, defaultFrom: "/dashboard/audit/paiement-facturation" },
      { href: "/dashboard/audit/service-client", label: "Service Client" },
      { href: "/dashboard/audit/service-client/process", label: "Process", indent: true, defaultFrom: "/dashboard/audit/service-client" },
      { href: "/dashboard/audit/service-client/renouvellement", label: "Renouvellement", indent: true, defaultFrom: "/dashboard/audit/service-client" },
      { href: "/dashboard/audit/service-client/cross-sell-upsell", label: "Cross-sell / Upsell", indent: true, defaultFrom: "/dashboard/audit/service-client" },
      { href: "/dashboard/donnees", label: "Rapprochement données" },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    pages: [
      { href: "/dashboard/tableaux-de-bord", label: "Tableaux de bord" },
      { href: "/dashboard/mes-rapports", label: "Mes rapports" },
    ],
  },
  {
    id: "alertes",
    title: "Suivi",
    pages: [
      { href: "/dashboard/mes-alertes", label: "Alertes" },
      { href: "/dashboard/mes-alertes/actions", label: "Actions" },
      { href: "/dashboard/mes-alertes/objectifs", label: "Objectifs" },
      { href: "/dashboard/mes-alertes/calendrier", label: "Calendrier" },
      { href: "/dashboard/enrichissement", label: "Enrichissement" },
    ],
  },
];

// Bloc « Paramètres » — réservé aux ADMINS : qui peut voir/modifier chaque page
// de Paramètres. Par défaut, tout est ouvert (comportement historique) ; la
// Visualisation refusée masque l'onglet correspondant (ParametresTabs).
const PARAMETRES_SECTION: Section = {
  id: "parametres",
  title: "Paramètres",
  pages: [
    { href: "/dashboard/parametres/general", label: "Général" },
    { href: "/dashboard/parametres/equipe", label: "Utilisateurs & équipes" },
    { href: "/dashboard/parametres/agents", label: "Agents" },
    { href: "/dashboard/parametres/enrichissement", label: "Enrichissement" },
    { href: "/dashboard/parametres/cohortes", label: "Cohortes" },
    { href: "/dashboard/parametres/integrations", label: "Intégrations" },
    { href: "/dashboard/parametres/modele-donnees", label: "Modèle de données" },
    { href: "/dashboard/parametres/notifications", label: "Notifications" },
    { href: "/dashboard/parametres/tour-de-controle", label: "Tour de contrôle" },
    { href: "/dashboard/parametres/securite-api", label: "Sécurité & API" },
  ],
};

type Access = Record<string, Record<string, boolean>>; // équipe → droit → autorisé

/**
 * Accès par défaut d'une page : l'état des espaces de travail (WORKSPACE_NAV).
 * Une sous-page hérite du défaut de sa page parente (defaultFrom).
 */
function defaultAccess(sectionId: string, row: PageRow): Access {
  const ref = row.defaultFrom ?? row.href;
  const out: Access = {};
  for (const t of TEAMS) {
    // Paramètres : hors des règles d'espace (WORKSPACE_NAV) — ouvert par défaut.
    const visible = sectionId === "parametres" ? true : isChildVisible(t.id, sectionId, ref);
    out[t.id] = { view: visible, edit: visible, create: visible };
  }
  return out;
}

export function PageAccessSettings({ initialRules, isAdmin = false }: { initialRules: Record<string, Access>; isAdmin?: boolean }) {
  const router = useRouter();
  const [rules, setRules] = useState<Record<string, Access>>(initialRules);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Sous-pages repliées par défaut sous leur parent (Performances, Trésorerie,
  // Service Client…) — même esprit qu'« Outil source par page ». expanded[href
  // du parent] = true → sous-pages visibles. Sections repliables aussi.
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleParent = (href: string) => setExpandedParents((e) => ({ ...e, [href]: !e[href] }));
  const toggleSection = (id: string) => setCollapsedSections((c) => ({ ...c, [id]: !c[id] }));

  function accessFor(sectionId: string, row: PageRow): Access {
    const saved = rules[row.href];
    const def = defaultAccess(sectionId, row);
    if (!saved) return def;
    // Fusion : les droits non enregistrés retombent sur le défaut.
    const out: Access = {};
    for (const t of TEAMS) {
      out[t.id] = { ...def[t.id], ...(saved[t.id] ?? {}) };
    }
    return out;
  }

  function toggle(sectionId: string, row: PageRow, team: string, right: "view" | "edit" | "create") {
    const href = row.href;
    const cur = accessFor(sectionId, row);
    const next: Access = JSON.parse(JSON.stringify(cur));
    const on = !next[team][right];
    next[team][right] = on;
    // Cohérence : sans Visualisation, pas de Modification ni de Création ;
    // activer Modification/Création réactive la Visualisation.
    if (right === "view" && !on) {
      next[team].edit = false;
      next[team].create = false;
    }
    if ((right === "edit" || right === "create") && on) next[team].view = true;

    setRules((r) => ({ ...r, [href]: next }));
    setPendingHref(href);
    setError(null);
    void fetch("/api/page-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_href: href, access: next }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? "Enregistrement impossible.");
        } else {
          // La sidebar (serveur) reflète la Visualisation au prochain rendu.
          router.refresh();
        }
      })
      .catch(() => setError("Enregistrement impossible."))
      .finally(() => setPendingHref(null));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-600">Droits :</span>
        {RIGHTS.map((r) => (
          <span key={r.id} className="inline-flex items-center gap-1">
            <span aria-hidden>{r.icon}</span> {r.label}
          </span>
        ))}
        <span className="ml-auto text-slate-400">Sans réglage, une page suit l&apos;accès par défaut de l&apos;espace de travail.</span>
      </div>

      {error && <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p>}

      {(isAdmin ? [...SECTIONS, PARAMETRES_SECTION] : SECTIONS).map((section) => (
        <div key={section.id} className="card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection(section.id)}
            className="flex w-full items-center gap-2 border-b border-card-border bg-slate-50/60 px-4 py-2.5 text-left transition hover:bg-slate-100/60"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-slate-400 transition-transform ${collapsedSections[section.id] ? "-rotate-90" : ""}`} aria-hidden><polyline points="6 9 12 15 18 9" /></svg>
            <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
            {section.id === "parametres" && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Admin uniquement</span>
            )}
          </button>
          {!collapsedSections[section.id] && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2 font-medium">Page</th>
                  {TEAMS.map((t) => (
                    <th key={t.id} className="px-3 py-2 text-center font-medium">
                      <span aria-hidden>{t.icon}</span> {t.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.pages.map((p) => {
                  // Sous-page masquée tant que son parent n'est pas déplié.
                  if (p.indent && p.defaultFrom && !expandedParents[p.defaultFrom]) return null;
                  const childCount = p.indent ? 0 : section.pages.filter((c) => c.defaultFrom === p.href).length;
                  const access = accessFor(section.id, p);
                  const pending = pendingHref === p.href;
                  return (
                    <tr key={p.href} className="border-b border-slate-50 last:border-0">
                      <td className={`px-4 py-2.5 font-medium ${p.indent ? "pl-8 text-slate-500" : "text-slate-700"}`}>
                        {p.indent && <span className="mr-1 text-slate-300" aria-hidden>↳</span>}
                        {p.label}
                        {childCount > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleParent(p.href)}
                            className="ml-2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-500 transition hover:border-fuchsia-200 hover:text-fuchsia-600"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expandedParents[p.href] ? "" : "-rotate-90"}`} aria-hidden><polyline points="6 9 12 15 18 9" /></svg>
                            {childCount} sous-page{childCount > 1 ? "s" : ""}
                          </button>
                        )}
                      </td>
                      {TEAMS.map((t) => (
                        <td key={t.id} className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            {RIGHTS.map((r) => {
                              const on = access[t.id][r.id];
                              return (
                                <button
                                  key={r.id}
                                  type="button"
                                  disabled={pending}
                                  title={`${r.label} — ${t.label} ${on ? "(autorisé)" : "(refusé)"}`}
                                  aria-pressed={on}
                                  onClick={() => toggle(section.id, p, t.id, r.id)}
                                  className={`flex h-6 w-6 items-center justify-center rounded-md border text-[11px] transition disabled:opacity-50 ${
                                    on
                                      ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                                      : "border-slate-200 bg-white text-slate-300 hover:border-slate-300 hover:text-slate-500"
                                  }`}
                                >
                                  <span aria-hidden>{r.icon}</span>
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      ))}
    </div>
  );
}
