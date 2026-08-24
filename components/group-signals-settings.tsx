"use client";

import { useState } from "react";

/**
 * Signaux de RAPPROCHEMENT DE GROUPE (Paramètres → Enrichissement) — visibilité
 * des signaux utilisés pour proposer des hiérarchies parent/enfant à valider,
 * et opt-in du signal « ressemblance de nom » (désactivé par défaut : signal
 * faible). Après changement, relancer depuis la page Hiérarchie comptes.
 */

const DEFAULT_SIGNALS: Array<{ icon: string; title: string; desc: string }> = [
  { icon: "🎯", title: "Montant exact (deal ↔ facture)", desc: "Un deal gagné facturé au montant exact sur une AUTRE société non reliée — signal fort de facturation par une entité du groupe." },
  { icon: "🌐", title: "Domaine web partagé", desc: "Deux fiches CRM au même domaine web (hors domaines génériques) sans lien de groupe déclaré." },
  { icon: "🏛️", title: "Même SIREN, SIRET distincts", desc: "Même société au registre (SIREN) mais deux établissements (SIRET) — siège + agence, via l'enrichissement Sirene." },
];

export function GroupSignalsSettings({ initialNameMatch }: { initialNameMatch: boolean }) {
  const [nameMatch, setNameMatch] = useState(initialNameMatch);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

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
            <span aria-hidden className="mt-0.5 text-base">{s.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800">{s.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{s.desc}</p>
            </div>
            <span className="mt-0.5 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Actif</span>
          </div>
        ))}

        {/* Opt-in : ressemblance de nom (signal faible). */}
        <div className="flex items-start gap-3 px-4 py-3">
          <span aria-hidden className="mt-0.5 text-base">🔤</span>
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
      {saved && <p className="text-[11px] text-emerald-600">✓ Enregistré — relance le rapprochement pour l&apos;appliquer.</p>}
    </div>
  );
}
