"use client";

import { useState } from "react";

export type DedupRule = {
  id: string;
  entity: string;
  criteria: string;
  secondaryCriteria: string;
  action: string;
  warning: string | null;
  enabled: boolean;
};

/**
 * Règles par défaut — libellés d'action en langage clair :
 * - « Fusion automatique » : les deux fiches détectées comme un même
 *   enregistrement sont FUSIONNÉES (uniquement si critère primaire ET
 *   secondaire concordent ; désactivé par défaut — rien ne fusionne sans
 *   activation explicite).
 * - « Mise à jour sans doublon » : l'enregistrement déjà relié par son
 *   identifiant source est MIS À JOUR au lieu d'être recréé à chaque sync —
 *   aucune fusion, aucun risque de perte.
 */
export const DEFAULT_DEDUP_RULES: DedupRule[] = [
  { id: "contact_email", entity: "Contact", criteria: "email corporate (hors génériques)", secondaryCriteria: "domaine + nom (entre CRM et billing)", action: "Fusion automatique", warning: "Ne PAS matcher l'email billing avec l'email du signataire", enabled: false },
  { id: "company_siren", entity: "Company", criteria: "SIREN exact (France)", secondaryCriteria: "VAT + domaine + nom normalisé", action: "Fusion automatique", warning: "Un groupe avec 3 filiales = 3 SIRENs", enabled: false },
  { id: "company_intl_vat", entity: "Company (int.)", criteria: "VAT number (hors France)", secondaryCriteria: "domaine + nom + pays", action: "Fusion automatique", warning: "Le VAT change en cas de restructuration dans certains pays UE", enabled: false },
  { id: "deal_external_id", entity: "Deal", criteria: "external_id par source", secondaryCriteria: "company_id + amount + mois de close", action: "Mise à jour sans doublon", warning: null, enabled: false },
  { id: "invoice_source_id", entity: "Invoice", criteria: "source_id (stripe_id / pennylane_id)", secondaryCriteria: "number + montant + date", action: "Mise à jour sans doublon", warning: "Un avoir peut avoir le même montant qu'une facture", enabled: false },
  { id: "ticket_source_id", entity: "Ticket", criteria: "source_id (zendesk_id / intercom_id)", secondaryCriteria: "external_number + opened_at", action: "Mise à jour sans doublon", warning: null, enabled: false },
];

export function DedupRules({ rules }: { rules: DedupRule[] }) {
  const [states, setStates] = useState<Record<string, boolean>>(
    Object.fromEntries(rules.map((r) => [r.id, r.enabled])),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(id: string) {
    setStates((prev) => ({ ...prev, [id]: !prev[id] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/dedup-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: states }),
      });
      if (res.ok) setSaved(true);
    } catch {}
    setSaving(false);
  }

  return (
    <div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
              <th className="px-5 py-2">Entité</th>
              <th className="px-5 py-2">Critère primaire</th>
              <th className="px-5 py-2">Critère secondaire</th>
              <th className="px-5 py-2">Action</th>
              <th className="px-5 py-2 text-right">Activer</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => {
              const isActive = states[rule.id] ?? rule.enabled;
              return (
                <tr key={rule.id} className={`border-b border-card-border last:border-0 transition ${!isActive ? "opacity-50" : ""}`}>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{rule.entity}</td>
                  <td className="px-5 py-2.5 text-slate-600">
                    {rule.criteria}
                    {rule.warning && (
                      <p className="mt-0.5 text-[10px] text-amber-600">⚠ {rule.warning}</p>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">{rule.secondaryCriteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{rule.action}</span>
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => toggle(rule.id)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
                        isActive ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                        isActive ? "translate-x-5" : "translate-x-0.5"
                      } mt-0.5`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Légende des actions — en langage clair (« fusion » ≠ « mise à jour »). */}
      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <p>
          <span className="font-semibold text-slate-700">Fusion automatique</span> : les deux fiches détectées comme
          un même enregistrement sont fusionnées — uniquement quand le critère primaire ET le critère secondaire
          concordent, et seulement si tu actives la règle (désactivée par défaut : rien ne fusionne sans ton accord).
        </p>
        <p className="mt-1.5">
          <span className="font-semibold text-slate-700">Mise à jour sans doublon</span> : l&apos;enregistrement déjà
          relié par son identifiant source (id Stripe, Pennylane…) est mis à jour à chaque sync au lieu d&apos;être
          recréé. Aucune fusion, aucun risque — ça évite simplement les doublons techniques.
        </p>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {saved && <span className="text-xs font-medium text-emerald-600">✓ Enregistré</span>}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
