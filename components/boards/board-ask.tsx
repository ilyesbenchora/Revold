"use client";

import { useEffect, useRef, useState } from "react";
import { DictationButton } from "@/components/dictation-button";
import { basePageKey } from "@/lib/kpi/tile-catalog";

/**
 * Bloc CONVERSATIONNEL d'une page de données / d'un tableau de bord : pose une
 * question, l'agent expert de la page répond en recalculant via le moteur
 * déterministe (/api/boards/ask — jamais un chiffre inventé).
 *
 * Les EXEMPLES (placeholder + puces cliquables) s'adaptent à la page ET aux
 * outils réellement connectés dessus (mapping « Outil source par page ») :
 * pas de « combien de deals ? » sur une page sans CRM.
 */

type Exchange = { q: string; a: string; agent?: { name: string; role: string } | null };

type SourceTool = { key: string; label: string; category: string };

/** Exemples par famille de page — chaque exemple exige une catégorie d'outil. */
/**
 * Suggestions PAR PAGE — chaque exemple porte les catégories d'outils qu'il
 * requiert (`cats`). Les questions CROISÉES vivent DANS le pool de la page
 * concernée (plus d'injection globale CRM×facturation qui polluait toutes les
 * pages) : ainsi chaque page ne propose que des questions qui lui sont propres,
 * et le croisé n'apparaît que là où il a du sens ET quand les outils sont là.
 * Les mono-outil sont listés d'abord (cœur de la page), le croisé ensuite.
 */
const EXAMPLES: Record<string, Array<{ cats: string[]; q: string }>> = {
  // Ventes
  perf_ventes: [
    { cats: ["crm"], q: "Combien de deals gagnés ce mois-ci ?" },
    { cats: ["crm"], q: "Quel est le montant du pipeline en cours ?" },
    { cats: ["crm"], q: "Quel est mon taux de perte ce trimestre ?" },
    { cats: ["crm"], q: "Combien de deals ont une close date dépassée ?" },
    { cats: ["crm", "billing"], q: "Quel écart entre le CA signé et le CA facturé ce trimestre ?" },
  ],
  // Marketing
  perf_marketing: [
    { cats: ["crm"], q: "Combien de contacts MQL ce mois-ci ?" },
    { cats: ["crm"], q: "Quelle part de mes contacts devient SQL ?" },
    { cats: ["crm"], q: "Combien de deals créés ce mois-ci ?" },
    { cats: ["ads"], q: "Quelles campagnes génèrent le plus de contacts ?" },
    { cats: ["ads", "crm"], q: "Quel canal d'acquisition amène le plus de deals gagnés ?" },
  ],
  // Trésorerie
  audit_paiement_facturation: [
    { cats: ["billing"], q: "Quel montant reste impayé aujourd'hui ?" },
    { cats: ["billing"], q: "Combien ai-je encaissé ce mois-ci ?" },
    { cats: ["billing"], q: "Quel est mon MRR actif en ce moment ?" },
    { cats: ["billing"], q: "Quelles sont mes plus grosses dépenses par catégorie ?" },
    { cats: ["crm", "billing"], q: "Le cash encaissé suit-il mes deals gagnés ce mois-ci ?" },
  ],
  // Service client
  audit_service_client: [
    { cats: ["support"], q: "Combien de tickets sont encore ouverts ?" },
    { cats: ["support"], q: "Quel est mon délai moyen de résolution ?" },
    { cats: ["support"], q: "Combien de tickets créés cette semaine ?" },
    { cats: ["support", "billing"], q: "Mes annulations d'abonnements suivent-elles le volume de tickets ?" },
    { cats: ["support", "crm"], q: "Quels comptes cumulent tickets en hausse et deals en cours ?" },
  ],
  // Connectivités outils (ex-Rapprochement données)
  audit_donnees: [
    { cats: ["crm"], q: "Combien d'entreprises sans SIREN renseigné ?" },
    { cats: ["crm"], q: "Combien de contacts sans email valide ?" },
    { cats: ["billing"], q: "Combien de factures proviennent de chaque outil ?" },
    { cats: ["crm", "billing"], q: "Combien d'entreprises non rapprochées entre CRM et facturation ?" },
  ],
  // Équipes / adoption
  audit_adoption: [
    { cats: ["crm"], q: "Quelle est la charge de deals par commercial ?" },
    { cats: ["crm"], q: "Qui a le meilleur taux de conversion ce trimestre ?" },
    { cats: ["crm"], q: "Combien de deals sans activité récente par propriétaire ?" },
  ],
  // Appels / téléphonie
  perf_appels: [
    { cats: ["phone"], q: "Quel volume d'appels ce mois-ci ?" },
    { cats: ["crm"], q: "Combien de deals créés cette semaine ?" },
    { cats: ["phone", "crm"], q: "Mes appels convertissent-ils en deals créés ?" },
  ],
  // Tableaux de bord créés / Vue d'ensemble : composés selon les outils.
  board: [
    { cats: ["crm"], q: "Combien de deals gagnés ce mois-ci ?" },
    { cats: ["billing"], q: "Quel montant facturé ce mois-ci ?" },
    { cats: ["billing"], q: "Quel montant reste impayé ?" },
    { cats: ["support"], q: "Combien de tickets ouverts ?" },
    { cats: ["crm"], q: "Combien d'entreprises par segment ?" },
  ],
};

/** Famille d'exemples de la page (les sous-pages héritent de leur parente). */
function familyOf(pageKey: string): string {
  if (pageKey === "tableau_bord" || pageKey.startsWith("board_")) return "board";
  const base = basePageKey(pageKey);
  if (EXAMPLES[base]) return base;
  if (pageKey.startsWith("perf_appels")) return "perf_appels";
  return "board";
}

/** Exemples réellement posables : filtrés par les catégories d'outils connectés. */
function buildExamples(pageKey: string, tools: SourceTool[] | null): string[] {
  const pool = EXAMPLES[familyOf(pageKey)] ?? EXAMPLES.board;
  // Outils pas encore chargés : exemples de la page telle quelle (mono-outil).
  if (tools === null) return pool.filter((e) => e.cats.length === 1).slice(0, 3).map((e) => e.q);
  const cats = new Set(tools.map((t) => t.category));
  // Ne garder que les questions dont TOUS les outils requis sont connectés,
  // dans l'ordre du pool (mono-outil d'abord, croisé propre à la page ensuite).
  const matched = pool.filter((e) => e.cats.every((c) => cats.has(c))).map((e) => e.q);
  // Rien de connecté pour cette page → on montre quand même 2 questions
  // mono-outil PROPRES à la page (jamais le pool générique d'une autre page).
  const list = matched.length > 0 ? matched : pool.filter((e) => e.cats.length === 1).slice(0, 2).map((e) => e.q);
  return [...new Set(list)].slice(0, 3);
}

export function BoardAsk({ pageKey }: { pageKey: string }) {
  const [question, setQuestion] = useState("");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tools, setTools] = useState<SourceTool[] | null>(null);
  // Conversation repliée (✕) : l'historique reste, le bloc redevient une ligne.
  const [collapsed, setCollapsed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Outils connectés SUR CETTE PAGE (même source de vérité que le funnel) →
  // les exemples proposés sont réellement posables.
  useEffect(() => {
    let alive = true;
    fetch(`/api/integrations/connected?page_key=${encodeURIComponent(pageKey)}`)
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => alive && setTools(Array.isArray(d.tools) ? d.tools : []))
      .catch(() => alive && setTools([]));
    return () => { alive = false; };
  }, [pageKey]);

  const examples = buildExamples(pageKey, tools);

  async function ask(text?: string) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const history = exchanges.slice(-3).flatMap((e) => [
        { role: "user", content: e.q },
        { role: "assistant", content: e.a },
      ]);
      const res = await fetch("/api/boards/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, question: q, history }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || typeof d.text !== "string") {
        setError(d.error ?? "Réponse impossible — réessaie.");
        return;
      }
      setExchanges((prev) => [
        ...prev.slice(-4),
        { q, a: d.text, agent: d.agent?.name ? { name: d.agent.name, role: d.agent.role ?? "" } : null },
      ]);
      setCollapsed(false);
      setQuestion("");
    } catch {
      setError("Réponse impossible — réessaie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-tour="board-ask" className="rounded-2xl border border-fuchsia-200/60 bg-gradient-to-r from-fuchsia-50/40 via-white to-white p-3">
      {/* TOUT sur UNE ligne : champ de question + suggestions adaptées (un
          clic = la réponse, défilement horizontal si étroites) + dictée + CTA. */}
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base leading-none">✨</span>
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Pose une question sur cette page…"
          disabled={busy}
          className="min-w-[11rem] flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 disabled:opacity-60"
        />
        {/* 2 suggestions max, JAMAIS de barre de défilement : ce qui ne tient
            pas est coupé net (overflow-hidden) ; masquées sur petit écran. */}
        {exchanges.length === 0 && examples.length > 0 && (
          <div className="hidden min-w-0 max-w-[55%] flex-nowrap items-center gap-1.5 overflow-hidden md:flex">
            {examples.slice(0, 2).map((e) => (
              <button
                key={e}
                type="button"
                disabled={busy}
                onClick={() => void ask(e)}
                className="shrink-0 whitespace-nowrap rounded-full border border-fuchsia-200/70 bg-white px-2.5 py-0.5 text-[11px] text-slate-500 transition hover:border-fuchsia-400 hover:text-fuchsia-700 disabled:opacity-50"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <DictationButton onText={(t) => setQuestion((q) => (q ? `${q} ${t}` : t))} title="Dicter la question" />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || !question.trim()}
          className="shrink-0 rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
        >
          {busy ? "Je calcule…" : "Demander"}
        </button>
      </div>

      {error && <p className="mt-2 px-6 text-xs text-rose-600">{error}</p>}

      {/* Conversation REPLIÉE : une ligne discrète pour la rouvrir. */}
      {exchanges.length > 0 && collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="mt-1.5 pl-6 text-[11px] font-medium text-slate-400 transition hover:text-fuchsia-600"
        >
          ▸ Revoir la conversation ({exchanges.length} réponse{exchanges.length > 1 ? "s" : ""})
        </button>
      )}

      {exchanges.length > 0 && !collapsed && (
        <div className="relative mt-3 space-y-3 border-t border-fuchsia-100 px-1 pt-3">
          {/* ✕ : replie la conversation — le bloc redevient une simple ligne. */}
          <button
            type="button"
            title="Fermer la conversation"
            onClick={() => setCollapsed(true)}
            className="absolute right-0 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
          >
            ✕
          </button>
          {exchanges.map((e, i) => (
            <div key={i}>
              <p className="pr-7 text-[11px] font-medium text-slate-400">« {e.q} »</p>
              {e.agent && (
                <p className="mt-1 text-[10px] font-semibold text-fuchsia-600">
                  {e.agent.name}
                  {e.agent.role && <span className="font-normal text-slate-400"> · {e.agent.role}</span>}
                </p>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{e.a}</p>
            </div>
          ))}
          <p className="text-[10px] text-slate-400">
            Chiffres recalculés en direct sur tes données synchronisées — jamais inventés.{" "}
            <button
              type="button"
              onClick={() => { setExchanges([]); setCollapsed(false); }}
              className="font-medium text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
            >
              Effacer
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
