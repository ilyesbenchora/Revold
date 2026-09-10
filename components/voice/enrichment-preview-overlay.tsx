"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * APERÇU DYNAMIQUE des fiches à enrichir — ouvert depuis la fenêtre
 * « à traiter » du brief : la home reste visible en fond (estompée), les
 * fiches défilent UNE PAR UNE avec leurs informations clés, et chacune peut
 * être enrichie immédiatement (exécution réelle, résultat honnête affiché)
 * ou remise à plus tard.
 */

type PendingCompany = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  siren: string | null;
  candidate_siren: string | null;
  candidate_legal_name: string | null;
  duplicate_of_siren: string | null;
  legal_name: string | null;
  official_employee_range: string | null;
  official_revenue: number | null;
  enriched_at: string | null;
  sirene_checked_at: string | null;
  kind: "identity" | "facts";
};

type FicheOutcome = { tone: "pos" | "warn" | "neutral"; label: string };

const eur = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

/** Résultat lisible d'une exécution, déduit du NOUVEL état réel de la fiche. */
function outcomeOf(before: PendingCompany, after: PendingCompany | null): FicheOutcome {
  if (!after) return { tone: "neutral", label: "Fiche traitée — état non relu, vérifie sur la page Enrichissement." };
  if (!before.siren && after.siren) {
    return { tone: "pos", label: `✓ Identifiée : SIREN ${after.siren}${after.legal_name ? ` — ${after.legal_name}` : ""}.` };
  }
  if (!before.siren && after.duplicate_of_siren) {
    return { tone: "warn", label: `Même société qu'une autre fiche (SIREN ${after.duplicate_of_siren}) — doublon ou établissement, voir Hiérarchie comptes.` };
  }
  if (!before.siren && after.candidate_siren) {
    return { tone: "warn", label: `Correspondance plausible (${after.candidate_legal_name ?? after.candidate_siren}) — à confirmer dans « Identités à valider ».` };
  }
  if (before.kind === "facts" && after.enriched_at && after.enriched_at !== before.enriched_at) {
    const facts = [
      after.official_employee_range ? `effectif ${after.official_employee_range}` : null,
      after.official_revenue != null ? `CA officiel ${eur(after.official_revenue)}` : null,
    ].filter(Boolean);
    return { tone: "pos", label: `✓ Rafraîchie${facts.length > 0 ? ` : ${facts.join(", ")}` : " — pas de nouvelle donnée publiée au registre"}.` };
  }
  if (!before.siren && !after.siren) {
    return { tone: "neutral", label: "Aucune correspondance sûre au registre pour ce nom — rien n'a été écrit (Revold ne devine jamais)." };
  }
  return { tone: "neutral", label: "Fiche vérifiée — aucun changement à écrire." };
}

export function EnrichmentPreviewOverlay({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [fiches, setFiches] = useState<PendingCompany[] | null>(null);
  const [activated, setActivated] = useState(true);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Résultat par fiche (id → outcome) : affiché sur la fiche après exécution.
  const [outcomes, setOutcomes] = useState<Record<string, FicheOutcome>>({});

  useEffect(() => {
    let alive = true;
    void fetch("/api/enrichment/pending?limit=8")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setActivated(d.activated !== false);
        setFiches(Array.isArray(d.pending) ? d.pending : []);
      })
      .catch(() => alive && setFiches([]));
    return () => { alive = false; };
  }, []);

  // Échap = fermer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const current = fiches?.[index] ?? null;
  const doneCount = Object.keys(outcomes).length;

  async function enrichNow(fiche: PendingCompany) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/enrichment/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: fiche.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Enrichissement impossible");
      if (d.inactive) {
        // Opt-in jamais posé : on route vers la page (le moteur s'y lance).
        onClose();
        router.push("/dashboard/enrichissement");
        return;
      }
      setOutcomes((prev) => ({ ...prev, [fiche.id]: outcomeOf(fiche, (d.company as PendingCompany | null) ?? null) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusy(false);
    }
  }

  const next = () => setIndex((i) => Math.min((fiches?.length ?? 1) - 1, i + 1));
  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const isLast = fiches != null && index >= fiches.length - 1;

  return (
    // Fond : la home reste visible, simplement estompée — l'aperçu est au centre.
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-card-border bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Fiches à enrichir"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Fiches à enrichir{fiches && fiches.length > 0 ? ` · ${Math.min(index + 1, fiches.length)}/${fiches.length}` : ""}
          </p>
          <button type="button" onClick={onClose} aria-label="Fermer l'aperçu" className="rounded p-1 text-slate-300 transition hover:text-slate-500">✕</button>
        </div>

        {fiches === null ? (
          <p className="py-10 text-center text-sm text-slate-400">Chargement des fiches en attente…</p>
        ) : fiches.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Plus aucune fiche en attente — l&apos;entretien automatique a rattrapé la file.
          </p>
        ) : current ? (
          <div className="mt-3">
            {/* ── Informations clés de la fiche ── */}
            <p className="text-lg font-semibold text-slate-900">{current.name ?? "Entreprise sans nom"}</p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Domaine</p>
                <p className="mt-0.5 truncate text-slate-700">{current.domain ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Secteur CRM</p>
                <p className="mt-0.5 truncate text-slate-700">{current.industry ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SIREN</p>
                <p className="mt-0.5 tabular-nums text-slate-700">{current.siren ?? "manquant"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">À faire</p>
                <p className="mt-0.5 text-slate-700">
                  {current.kind === "identity" ? "Identifier au registre Sirene" : "Rafraîchir effectifs / CA officiels"}
                </p>
              </div>
            </div>
            {current.kind === "facts" && (current.official_employee_range || current.official_revenue != null) && (
              <p className="mt-2 text-[11px] text-slate-500">
                Connu aujourd&apos;hui : {[current.official_employee_range ? `effectif ${current.official_employee_range}` : null, current.official_revenue != null ? `CA ${eur(current.official_revenue)}` : null].filter(Boolean).join(" · ")}
              </p>
            )}

            {/* ── Résultat d'exécution (honnête, depuis l'état réel relu) ── */}
            {outcomes[current.id] && (
              <p
                className={`mt-3 rounded-lg px-3 py-2 text-[11px] leading-snug ${
                  outcomes[current.id].tone === "pos"
                    ? "bg-emerald-50 text-emerald-700"
                    : outcomes[current.id].tone === "warn"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-50 text-slate-600"
                }`}
              >
                {outcomes[current.id].label}
              </p>
            )}
            {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[11px] text-rose-600">{error}</p>}
            {!activated && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                Le moteur n&apos;a jamais été lancé — « Enrichir maintenant » t&apos;emmènera sur la page Enrichissement pour la première passe.
              </p>
            )}

            {/* ── Actions : exécuter cette fiche, plus tard, navigation ── */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={prev}
                  disabled={busy || index === 0}
                  aria-label="Fiche précédente"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={next}
                  disabled={busy || isLast}
                  aria-label="Fiche suivante"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:opacity-30"
                >
                  ›
                </button>
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (isLast ? onClose() : next())}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  {isLast ? "Terminer" : "Plus tard"}
                </button>
                {outcomes[current.id] ? (
                  <button
                    type="button"
                    onClick={() => (isLast ? onClose() : next())}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                  >
                    {isLast ? "✓ Terminer" : "Fiche suivante →"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void enrichNow(current)}
                    disabled={busy}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                  >
                    {busy ? "Enrichissement…" : "⚡ Enrichir maintenant"}
                  </button>
                )}
              </span>
            </div>

            {doneCount > 0 && (
              <p className="mt-3 text-center text-[10px] text-slate-400">
                {doneCount} fiche{doneCount > 1 ? "s" : ""} traitée{doneCount > 1 ? "s" : ""} sur {fiches.length} — le reste continue en automatique.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
