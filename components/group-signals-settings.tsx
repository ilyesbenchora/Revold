"use client";

import { useEffect, useState } from "react";
import { SettingsSaveButton } from "@/components/settings-edit-lock";

/**
 * Signaux de RAPPROCHEMENT DE GROUPE (Paramètres → Enrichissement) — visibilité
 * des signaux utilisés pour proposer des hiérarchies parent/enfant à valider,
 * et opt-in du signal « ressemblance de nom » (désactivé par défaut : signal
 * faible). Après changement, relancer depuis la page Hiérarchie comptes.
 */

type Diag = {
  companies: number | null; withSiren: number | null; withSiret: number | null;
  withDomain: number | null; dupSiren: number | null; wonDeals: number | null; unlinkedInvoices: number | null;
  nameEnabled?: boolean; bySignal?: Record<string, number>; detectError?: string | null;
};

const nf = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("fr-FR"));

const DEFAULT_SIGNALS: Array<{ title: string; desc: string; coverage: (d: Diag) => string }> = [
  {
    title: "Montant exact (deal ↔ facture)",
    desc: "Un deal gagné facturé au montant exact sur une AUTRE société non reliée — signal fort de facturation par une entité du groupe.",
    coverage: (d) => `${nf(d.wonDeals)} deals gagnés · ${nf(d.unlinkedInvoices)} factures non rattachées à croiser`,
  },
  {
    title: "Domaine web partagé",
    desc: "Deux fiches CRM au même domaine web (hors domaines génériques) sans lien de groupe déclaré.",
    coverage: (d) => `${nf(d.withDomain)} / ${nf(d.companies)} entreprises ont un domaine renseigné`,
  },
  {
    title: "Même SIREN, SIRET distincts",
    desc: "Se déclenche quand DEUX fiches CRM différentes portent le même SIREN (doublon repéré à l'enrichissement) avec des SIRET différents : c'est la même société légale vue à deux établissements (siège + agence). Rare par nature — il faut ce doublon, pas seulement qu'une fiche ait un SIREN.",
    coverage: (d) => `${nf(d.withSiren)} avec SIREN · ${nf(d.withSiret)} avec SIRET · ${nf(d.dupSiren)} doublons SIREN (établissements)`,
  },
];

export function GroupSignalsSettings({ initialNameMatch }: { initialNameMatch: boolean }) {
  const [nameMatch, setNameMatch] = useState(initialNameMatch);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [diag, setDiag] = useState<Diag | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/hierarchy/diagnostic")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d) setDiag(d as Diag); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  async function toggle(next: boolean) {
    if (busy) return;
    setBusy(true);
    setNameMatch(next); // optimiste
    try {
      const res = await fetch("/api/hierarchy/name-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setNameMatch(!next); // rollback
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Signaux de rapprochement de groupe</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Les signaux avec lesquels Revold détecte les groupes multi-entités et propose des hiérarchies parent/enfant à
          valider (page{" "}
          <a href="/dashboard/hierarchie" className="font-medium text-accent hover:underline">Hiérarchie comptes</a>).
          Jamais écrit sans validation.
        </p>
      </div>

      <div className="card divide-y divide-slate-100">
        {DEFAULT_SIGNALS.map((s) => (
          <div key={s.title} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{s.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.desc}</p>
              {diag && (
                <p className="mt-1 text-[10px] font-medium text-slate-400">
                  <span className="text-slate-500">Couverture :</span> {s.coverage(diag)}
                </p>
              )}
            </div>
            <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Actif</span>
          </div>
        ))}

        {/* Opt-in : ressemblance de nom (signal faible). */}
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800">Ressemblance de nom <span className="text-[10px] font-normal text-slate-400">(signal faible)</span></p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Rapproche des fiches aux noms structurellement apparentés (préfixe, ou marqueur « holding/groupe »).
              Désactivé par défaut : deux sociétés au nom proche peuvent être indépendantes (franchises, homonymes).
              Une fois activé, relance depuis <a href="/dashboard/hierarchie" className="font-medium text-accent hover:underline">Hiérarchie comptes</a>.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={nameMatch}
            disabled={busy}
            onClick={() => toggle(!nameMatch)}
            className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition disabled:opacity-50 ${nameMatch ? "bg-accent" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${nameMatch ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
      </div>
      {/* Répartition des propositions actuelles par signal — montre d'où vient le total. */}
      {diag?.bySignal && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[11px] text-slate-600">
          <p className="font-medium text-slate-700">
            Propositions détectées (en direct) par signal :{" "}
            <span className="font-normal">
              montant {nf(diag.bySignal.billing_match)} · domaine {nf(diag.bySignal.shared_domain)} · SIREN {nf(diag.bySignal.same_siren)} · nom {nf(diag.bySignal.name_match)}
            </span>
          </p>
          {diag.detectError && (
            <p className="mt-0.5 text-rose-700">⚠ Le détecteur a échoué : {diag.detectError}</p>
          )}
          {diag.nameEnabled === false && (
            <p className="mt-0.5 text-amber-700">
              ⚠ Le signal « nom » est <strong>désactivé</strong> — active-le ci-dessus (clique « ✎ Modifier » d&apos;abord), puis relance le rapprochement.
            </p>
          )}
          {diag.nameEnabled === true && !diag.detectError && (diag.bySignal.name_match ?? 0) === 0 && (
            <p className="mt-0.5 text-amber-700">
              ⚠ « Nom » est activé et le détecteur tourne (chiffres en direct), mais 0 par le nom : il manque probablement la fiche « mère » NUE (ex. « Banque Populaire » sans ville), ou les noms ne partagent pas un préfixe EXACT (abréviations, variantes). Dis-le moi, j&apos;adapte la règle.
            </p>
          )}
          {diag.nameEnabled === true && (diag.bySignal.name_match ?? 0) > 0 && (
            <p className="mt-0.5 text-emerald-700">
              ✓ Le nom détecte {nf(diag.bySignal.name_match)} rapprochements — clique « Relancer la détection » sur Hiérarchie comptes pour les faire apparaître.
            </p>
          )}
        </div>
      )}
      {saved && <p className="text-[11px] text-emerald-600">✓ Enregistré — relance le rapprochement pour l&apos;appliquer.</p>}

      {/* CTA UNIQUE identique aux autres blocs de réglages (verrou d'édition). */}
      <div className="flex justify-end pt-1">
        <SettingsSaveButton editLabel="✎ Modifier" label="Enregistrer" onSave={() => true} />
      </div>
    </div>
  );
}
