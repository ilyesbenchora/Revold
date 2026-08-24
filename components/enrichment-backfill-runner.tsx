"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ENRICHMENT_FIELD_LABELS, type EnrichmentFields } from "@/lib/enrichment/settings";
import { EnrichedCompaniesPanel } from "@/components/enriched-companies-panel";

/**
 * État de l'enrichissement + CTA « Enrichir mon CRM » + historique des passes.
 *
 * Le robot de fond (cron) entretient la base en continu ; ici, le CTA lance
 * une PASSE explicite : fenêtre de complétion qui coche une à une les
 * catégories de données (SIREN, SIRET, TVA…) puis synchronise le CRM HubSpot.
 * Après une première passe complète, le CTA s'efface au profit d'un état
 * « synchronisé » ; il ne revient que si de NOUVEAUX champs sont cochés dans
 * Paramètres → Enrichissement — la passe suivante ne porte alors que sur la
 * nouvelle donnée (compteurs repartis à zéro sur ce périmètre).
 */

const POLL_MS = 20_000;

type Status = {
  total: number | null;
  withSiren: number | null;
  withEmployees: number | null;
  candidates: number | null;
  duplicates: number | null;
  fieldCounts?: Record<string, number | null>;
  remaining: number;
  processed: number;
  pct: number;
  lastActivityAt: string | null;
  inProgress: boolean;
};

type Batch = {
  lookupsUsed: number;
  identities: number;
  candidates: number;
  facts: number;
  duplicates: number;
  interrupted?: boolean;
  error?: string;
};

type Run = {
  id: string;
  started_at: string;
  finished_at: string | null;
  fields: string[];
  scope_total: number;
  stats: Record<string, number>;
  status: "running" | "done" | "interrupted";
  derived?: boolean;
};

const FIELD_LABEL: Record<string, string> = Object.fromEntries(ENRICHMENT_FIELD_LABELS.map((f) => [f.id, f.label]));

/** Libellés courts pour le détail des passes (« +12 effectifs ») dans l'historique. */
const FIELD_SHORT: Record<string, string> = {
  siren: "SIREN",
  siret: "SIRET",
  vat: "N° TVA",
  employees: "effectifs",
  revenue: "CA",
  industry: "secteurs",
  legalForm: "statuts juridiques",
  shareCapital: "capitaux sociaux",
  headOfficeAddress: "adresses siège",
};

const fmt = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

function sinceFr(iso: string | null): string {
  if (!iso) return "en attente du premier passage";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

const dateTimeFr = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function EnrichmentBackfillRunner({
  fields,
  hubspotSearchIds = true,
  activated = true,
}: {
  fields: EnrichmentFields;
  hubspotSearchIds?: boolean;
  /** false = l'org n'a JAMAIS lancé l'enrichissement (état neutre, jamais « enrichi »). */
  activated?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [covered, setCovered] = useState<string[]>([]);
  const [session, setSession] = useState({ identities: 0, candidates: 0, facts: 0, duplicates: 0 });
  const [notice, setNotice] = useState<string | null>(null);

  // ── Passe en cours (fenêtre de complétion) ──
  const [modalOpen, setModalOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "engine" | "crm" | "done" | "interrupted">("idle");
  const [passScope, setPassScope] = useState(0);
  const [passRemaining, setPassRemaining] = useState(0);
  const [crmProgress, setCrmProgress] = useState<{ done: number; total: number; pushed: number; failed: number } | null>(null);

  const mountedRef = useRef(true);
  const runningRef = useRef(false);

  const loadStatus = useCallback(async (): Promise<Status | null> => {
    try {
      const res = await fetch("/api/enrichment/status");
      if (!res.ok) return null;
      const d = (await res.json()) as Status;
      if (mountedRef.current) setStatus(d);
      return d;
    } catch {
      return null;
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const res = await fetch("/api/enrichment/runs");
      if (!res.ok) return;
      const d = (await res.json()) as { runs: Run[]; covered: string[] };
      if (mountedRef.current) {
        setRuns(d.runs);
        setCovered(d.covered);
      }
    } catch {
      /* historique indisponible */
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadStatus();
    void loadRuns();
    return () => {
      mountedRef.current = false;
    };
  }, [loadStatus, loadRuns]);

  // Suivi du robot de fond même sans passe locale.
  useEffect(() => {
    if (!status?.inProgress || runningRef.current) return;
    const iv = setInterval(() => void loadStatus(), POLL_MS);
    return () => clearInterval(iv);
  }, [status?.inProgress, loadStatus]);

  const activeFieldIds = ENRICHMENT_FIELD_LABELS.filter((f) => fields[f.id]).map((f) => f.id as string);
  const inactiveFieldIds = ENRICHMENT_FIELD_LABELS.filter((f) => !fields[f.id]).map((f) => f.id as string);
  // Nouveaux champs cochés depuis la dernière passe → le CTA principal revient.
  const newFields = runs == null ? [] : activeFieldIds.filter((f) => !covered.includes(f));
  const remaining = status?.remaining ?? 0;
  const needsRun = remaining > 0 || newFields.length > 0;

  /** Lance une passe complète : moteur (registre) puis synchronisation CRM. */
  const startPass = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setModalOpen(true);
    setPhase("engine");
    setNotice(null);
    setSession({ identities: 0, candidates: 0, facts: 0, duplicates: 0 });
    setCrmProgress(null);
    const totals = { identities: 0, candidates: 0, facts: 0, duplicates: 0 };
    let runId: string | null = null;
    let interrupted = false;
    // Couverture par champ AVANT la passe → le delta par donnée (SIREN,
    // effectifs, CA…) est consigné dans l'historique à la clôture.
    const baselineFieldCounts: Record<string, number | null> = { ...((await loadStatus())?.fieldCounts ?? {}) };

    try {
      // 1. Ouvre la passe — remet en file les fiches où les NOUVEAUX champs
      //    manquent (le moteur ne remplit que les champs vides : rien n'est écrasé).
      try {
        const res = await fetch("/api/enrichment/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start" }),
        });
        const d = await res.json().catch(() => ({}));
        runId = d.runId ?? null;
        setPassScope(d.scopeTotal ?? 0);
        setPassRemaining(d.scopeTotal ?? 0);
      } catch {
        /* la passe tourne même sans historique */
      }

      // 2. Moteur : enchaîne les lots tant qu'il reste du travail.
      for (;;) {
        if (!mountedRef.current) return;
        // activate:true — le clic sur le CTA vaut OPT-IN : il active le moteur
        // (accélérateur de fond + cron) pour cette org, une fois pour toutes.
        const res = await fetch("/api/enrichment/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ activate: true }),
        });
        const d = (await res.json().catch(() => ({}))) as Partial<Batch>;
        if (!mountedRef.current) return;
        if (!res.ok) {
          setNotice("Traitement poursuivi en tâche de fond.");
          interrupted = true;
          break;
        }
        totals.identities += d.identities ?? 0;
        totals.candidates += d.candidates ?? 0;
        totals.facts += d.facts ?? 0;
        totals.duplicates += d.duplicates ?? 0;
        setSession({ ...totals });
        const fresh = await loadStatus();
        if (fresh) setPassRemaining(fresh.remaining);
        if ((fresh?.remaining ?? 0) <= 0) break;
        if (d.interrupted) {
          setNotice("Le registre ne répond pas — nouvelle tentative dans 5 s.");
          await new Promise((r) => setTimeout(r, 5_000));
          if (!mountedRef.current) return;
          setNotice(null);
        } else if ((d.lookupsUsed ?? 0) === 0) {
          break;
        }
      }

      // 3. Synchronisation CRM : pousse les valeurs dans les fiches HubSpot
      //    (champs vides uniquement) — c'est cette étape qui aligne HubSpot
      //    sur Revold, fiche par fiche.
      let crmPushed = 0;
      let crmFailed = 0;
      if (hubspotSearchIds && !interrupted) {
        setPhase("crm");
        let cursor: string | null = null;
        let total = 0;
        let done = 0;
        for (;;) {
          if (!mountedRef.current) return;
          const res: Response = await fetch("/api/enrichment/push-hubspot-ids", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cursor }),
          });
          if (!res.ok) {
            setNotice("Synchronisation HubSpot indisponible — elle reprendra aux prochains passages du moteur.");
            break;
          }
          const d = await res.json();
          if (typeof d.total === "number") total = d.total;
          done += d.processed ?? 0;
          crmPushed += d.pushed ?? 0;
          crmFailed += d.failed ?? 0;
          setCrmProgress({ done, total, pushed: crmPushed, failed: crmFailed });
          if (d.done || !d.nextCursor) break;
          cursor = d.nextCursor;
        }
      }

      // 4. Clôt la passe (date/heure + compteurs → historique), avec le DÉTAIL
      //    PAR DONNÉE enrichie (delta de couverture champ par champ).
      if (runId) {
        const fieldStats: Record<string, number> = {};
        const after = (await loadStatus())?.fieldCounts ?? {};
        for (const [k, v] of Object.entries(after)) {
          const before = baselineFieldCounts[k];
          if (typeof v === "number" && typeof before === "number" && v > before) fieldStats[`field_${k}`] = v - before;
        }
        await fetch("/api/enrichment/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "finish",
            runId,
            status: interrupted ? "interrupted" : "done",
            stats: { ...totals, crmPushed, crmFailed, ...fieldStats },
          }),
        }).catch(() => {});
      }
      if (mountedRef.current) {
        setPhase(interrupted ? "interrupted" : "done");
        void loadRuns();
        void loadStatus();
        router.refresh();
      }
    } finally {
      runningRef.current = false;
    }
  }, [hubspotSearchIds, loadRuns, loadStatus, router]);

  // ── Fenêtre de complétion : catégories cochées une à une ──
  const engineProgress =
    passScope > 0 ? Math.min(1, Math.max(0, (passScope - passRemaining) / passScope)) : phase === "engine" ? 0 : 1;
  const nCats = activeFieldIds.length;
  const catsDone = phase === "engine" ? Math.floor(engineProgress * nCats) : nCats;

  const pct = status?.pct ?? 0;
  const inProgress = status?.inProgress ?? false;
  const sessionTotal = session.identities + session.facts + session.candidates + session.duplicates;
  const historyRuns = (runs ?? []).slice(0, 8);

  return (
    <>
      <div className="card border-fuchsia-200/70 bg-gradient-to-r from-fuchsia-50/50 via-white to-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {status == null ? (
                // Tant que l'état n'est pas chargé, on n'affiche NI « terminé »
                // NI « en cours » — sinon flash trompeur à chaque rafraîchissement.
                <>
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slate-300" />
                  Lecture de l&apos;avancement…
                </>
              ) : inProgress || runningRef.current ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-60" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-fuchsia-500" />
                  </span>
                  Enrichissement en cours
                </>
              ) : !activated ? (
                // JAMAIS « enrichi » tant que rien n'a été lancé : état neutre.
                <>Enrichissement pas encore lancé</>
              ) : newFields.length > 0 ? (
                <>✦ Nouveaux champs à enrichir</>
              ) : (
                <>✓ Base entièrement enrichie et synchronisée</>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {status == null ? (
                <>Récupération de l&apos;état réel de ta base…</>
              ) : inProgress || runningRef.current ? (
                <>
                  Revold traite ta base en continu, application ouverte ou fermée. Dernière avancée{" "}
                  <span className="font-medium text-slate-700">{sinceFr(status?.lastActivityAt ?? null)}</span>.
                </>
              ) : !activated ? (
                activeFieldIds.length > 0 ? (
                  // Les champs COCHÉS sont nommés : le message dit exactement ce
                  // que « Enrichir mon CRM » va synchroniser — jamais un feu
                  // vert à l'aveugle.
                  <>
                    Rien ne tourne sans ton feu vert. Au clic sur « Enrichir mon CRM », Revold enrichira :{" "}
                    <span className="font-medium text-slate-700">
                      {activeFieldIds.map((f) => FIELD_LABEL[f] ?? f).join(", ")}
                    </span>{" "}
                    — modifiable dans{" "}
                    <Link href="/dashboard/parametres/enrichissement" className="font-medium text-accent hover:underline">
                      Paramètres → Enrichissement
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Rien ne tourne sans ton feu vert : coche les données à enrichir dans{" "}
                    <Link href="/dashboard/parametres/enrichissement" className="font-medium text-accent hover:underline">
                      Paramètres → Enrichissement
                    </Link>{" "}
                    puis clique « Enrichir mon CRM ».
                  </>
                )
              ) : newFields.length > 0 ? (
                <>
                  <span className="font-medium text-slate-700">
                    {newFields.map((f) => FIELD_LABEL[f] ?? f).join(", ")}
                  </span>{" "}
                  — coché{newFields.length > 1 ? "s" : ""} dans les paramètres mais pas encore enrichi
                  {newFields.length > 1 ? "s" : ""} : lance une passe pour compléter la base et ton CRM.
                </>
              ) : (
                <>
                  Toute nouvelle entreprise arrivant dans la base est enrichie et synchronisée avec ton CRM
                  automatiquement — rafraîchissement des données évolutives tous les 90 jours.
                </>
              )}
            </p>
          </div>
          {/* % et barre de complétion : UNIQUEMENT une fois l'enrichissement
              lancé — avant le premier « Enrichir mon CRM », un 0 % serait un
              faux signal d'échec sur un moteur qui n'a jamais tourné. */}
          {status != null && (activated || inProgress || runningRef.current) && (
            <p className="shrink-0 text-right text-xs text-slate-500">
              <span className="block text-2xl font-bold tabular-nums text-slate-900">{pct} %</span>
              {fmt(status.processed)} traitées{remaining > 0 && <> · {fmt(remaining)} restantes</>}
            </p>
          )}
        </div>

        {(activated || inProgress || runningRef.current) && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-pink-600 transition-all duration-700 ${inProgress ? "animate-pulse" : ""}`}
              style={{ width: `${status == null ? 0 : Math.max(pct, 2)}%` }}
            />
          </div>
        )}

        {/* Le détail chiffré (identités, effectifs, doublons…) vit dans
            l'historique des enrichissements ci-dessous — pas ici. */}
        {status != null && sessionTotal > 0 && (
          <p className="mt-1.5 text-[11px] text-fuchsia-600">+{sessionTotal} pendant cette passe</p>
        )}

        {notice && !modalOpen && <p className="mt-1.5 text-[11px] font-medium text-amber-700">{notice}</p>}

        {/* ── CTA : passe complète tant qu'il reste du travail ou que de
               nouveaux champs sont cochés ; sinon état discret. ── */}
        {status != null && runs != null && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-fuchsia-100 pt-3">
            {!activated || needsRun ? (
              <>
                <p className="text-[11px] text-slate-400">
                  {!activated && activeFieldIds.length === 0 ? (
                    <>Coche d&apos;abord les données à enrichir dans Paramètres → Enrichissement — rien n&apos;est sélectionné.</>
                  ) : newFields.length > 0 ? (
                    <>La passe complète la base puis écrit chaque donnée dans ton CRM (champs vides uniquement).</>
                  ) : (
                    <>Lance la passe : identification au registre officiel puis synchronisation de ton CRM, en direct.</>
                  )}
                </p>
                <button
                  type="button"
                  disabled={runningRef.current || (!activated && activeFieldIds.length === 0)}
                  title={!activated && activeFieldIds.length === 0 ? "Aucune donnée cochée dans Paramètres → Enrichissement" : undefined}
                  onClick={() => void startPass()}
                  className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-60"
                >
                  🔁 Enrichir mon CRM
                </button>
              </>
            ) : (
              <>
                <p className="text-[11px] text-slate-400">
                  Première passe faite : la synchronisation couvre désormais chaque nouvelle entreprise, sans action de
                  ta part.
                </p>
                {inactiveFieldIds.length > 0 && (
                  <Link
                    href="/dashboard/parametres/enrichissement"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  >
                    ＋ Ajouter des données
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Historique des enrichissements (date, heure, champs, volumes) ── */}
      {historyRuns.length > 0 && (
        <div className="card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Historique des enrichissements
          </p>
          <ul className="mt-2 divide-y divide-slate-100">
            {historyRuns.map((r) => {
              const s = r.stats ?? {};
              // Détail PAR DONNÉE enrichie (« +12 SIREN · +30 effectifs ») quand
              // la passe l'a consigné ; sinon repli sur les compteurs globaux.
              const fieldParts = Object.entries(s)
                .filter(([k, v]) => k.startsWith("field_") && typeof v === "number" && v > 0)
                .map(([k, v]) => `+${fmt(v)} ${FIELD_SHORT[k.slice(6)] ?? FIELD_LABEL[k.slice(6)] ?? k.slice(6)}`);
              const parts = [
                ...(fieldParts.length > 0
                  ? fieldParts
                  : [
                      s.identities ? `${fmt(s.identities)} identités` : null,
                      s.facts ? `${fmt(s.facts)} fiches complétées` : null,
                    ].filter(Boolean)),
                s.candidates ? `${fmt(s.candidates)} à valider` : null,
                s.duplicates ? `${fmt(s.duplicates)} doublons détectés` : null,
                s.crmPushed ? `${fmt(s.crmPushed)} fiches CRM synchronisées` : null,
              ].filter(Boolean);
              return (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-700">
                      {dateTimeFr(r.started_at)}
                      {r.status === "running" ? (
                        <span className="ml-2 rounded-full bg-fuchsia-100 px-1.5 py-0.5 text-[10px] font-semibold text-fuchsia-700">
                          en cours
                        </span>
                      ) : r.status === "interrupted" ? (
                        <span className="ml-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          interrompue — reprise par le robot
                        </span>
                      ) : r.derived ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          enrichissement initial
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {(r.fields ?? []).map((f) => FIELD_LABEL[f] ?? f).join(" · ")}
                    </p>
                  </div>
                  <p className="text-[11px] tabular-nums text-slate-500">
                    {parts.length > 0 ? parts.join(" · ") : `${fmt(r.scope_total)} fiches au périmètre`}
                  </p>
                </li>
              );
            })}
          </ul>

          {/* ── Détail fiche par fiche : les entreprises enrichies, dépliables
                 ICI (même bloc que les passes — pas de carte doublon). ── */}
          <EnrichedCompaniesPanel />
        </div>
      )}

      {/* ── Fenêtre de complétion : catégories synchronisées une à une ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold text-slate-900">
              {phase === "done" ? "✓ CRM enrichi" : phase === "interrupted" ? "Passe interrompue" : "Enrichissement de ton CRM…"}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {phase === "engine" && (
                <>
                  Identification au registre officiel — {fmt(Math.max(0, passScope - passRemaining))}
                  {passScope > 0 && <> / {fmt(passScope)}</>} fiches traitées.
                </>
              )}
              {phase === "crm" && <>Écriture dans les fiches HubSpot (champs vides uniquement — rien n&apos;est écrasé).</>}
              {phase === "done" && <>Toutes les catégories actives sont synchronisées avec ton CRM.</>}
              {phase === "interrupted" && <>Le robot de fond reprendra automatiquement là où la passe s&apos;est arrêtée.</>}
            </p>

            <ul className="mt-4 space-y-2">
              {activeFieldIds.map((f, i) => {
                const done = i < catsDone;
                const active = phase === "engine" && i === catsDone;
                return (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    {done ? (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-600">
                        ✓
                      </span>
                    ) : active ? (
                      <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
                    ) : (
                      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                    )}
                    <span className={done ? "text-slate-700" : active ? "font-medium text-slate-900" : "text-slate-400"}>
                      {FIELD_LABEL[f] ?? f}
                    </span>
                    {done && <span className="ml-auto text-[10px] font-medium text-emerald-600">synchronisé</span>}
                  </li>
                );
              })}
              {hubspotSearchIds && (
                <li className="flex items-center gap-2.5 border-t border-slate-100 pt-2 text-sm">
                  {phase === "done" ? (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-600">
                      ✓
                    </span>
                  ) : phase === "crm" ? (
                    <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-fuchsia-500 border-t-transparent" />
                  ) : (
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                  )}
                  <span className={phase === "crm" ? "font-medium text-slate-900" : phase === "done" ? "text-slate-700" : "text-slate-400"}>
                    Synchronisation HubSpot
                  </span>
                  {crmProgress && phase !== "done" && (
                    <span className="ml-auto text-[10px] tabular-nums text-slate-500">
                      {fmt(crmProgress.done)}{crmProgress.total ? ` / ${fmt(crmProgress.total)}` : ""} fiches
                    </span>
                  )}
                  {phase === "done" && crmProgress && (
                    <span className="ml-auto text-[10px] font-medium text-emerald-600">
                      {fmt(crmProgress.pushed)} fiches mises à jour
                    </span>
                  )}
                </li>
              )}
            </ul>

            {notice && <p className="mt-3 text-[11px] font-medium text-amber-700">{notice}</p>}

            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-[10px] text-slate-400">
                {phase === "engine" || phase === "crm"
                  ? "Tu peux fermer cette fenêtre : la passe continue tant que la page reste ouverte."
                  : "Le détail est consigné dans l'historique de la page."}
              </p>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
