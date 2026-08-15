"use client";

import { useEffect, useState } from "react";

/**
 * Licence HubSpot du compte (Paramètres → Intégrations, carte HubSpot).
 * Connaître la licence permet de proposer les bonnes actions dès
 * l'onboarding : avec Sales Pro/Enterprise + une séquence choisie, les
 * relances de la boîte Actions deviennent de VRAIS emails (inscription en
 * séquence au nom du propriétaire du deal) au lieu de simples tâches.
 */

const LICENSE_OPTIONS = [
  { id: "free", label: "Free" },
  { id: "starter", label: "Sales Starter" },
  { id: "sales_pro", label: "Sales Pro" },
  { id: "sales_enterprise", label: "Sales Enterprise" },
];

export function HubspotLicenseForm() {
  const [license, setLicense] = useState<string>("");
  const [sequenceId, setSequenceId] = useState<string>("");
  const [sequences, setSequences] = useState<Array<{ id: string; name: string }>>([]);
  const [seqError, setSeqError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/hubspot-license");
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setLicense(d.license ?? "");
      setSequenceId(d.sequence_id ?? "");
      setSequences(Array.isArray(d.sequences) ? d.sequences : []);
      setSeqError(d.sequencesError ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const proPlus = license === "sales_pro" || license === "sales_enterprise";

  async function save(nextLicense: string, nextSequenceId: string) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const seqName = sequences.find((s) => s.id === nextSequenceId)?.name ?? null;
      const res = await fetch("/api/settings/hubspot-license", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license: nextLicense || null, sequence_id: nextSequenceId || null, sequence_name: seqName }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Enregistrement impossible");
      setSaved(true);
      // Passage à Pro : la liste des séquences devient disponible → recharge.
      if ((nextLicense === "sales_pro" || nextLicense === "sales_enterprise") && sequences.length === 0) void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Licence HubSpot</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Connaître ta licence permet de proposer les bonnes actions dès l&apos;onboarding. Avec <b>Sales Pro ou
        Enterprise</b> et une séquence choisie, les relances de la boîte Actions deviennent de <b>vrais emails</b> —
        le contact est inscrit dans la séquence au nom du propriétaire du deal (sa boîte connectée envoie) — au lieu
        de simples tâches.
      </p>
      {loading ? (
        <p className="mt-3 text-xs text-slate-400">Chargement…</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
            Licence
            <select
              value={license}
              onChange={(e) => { setLicense(e.target.value); void save(e.target.value, sequenceId); }}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-accent"
            >
              <option value="">Non renseignée</option>
              {LICENSE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          {proPlus && (
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
              Séquence de relance
              <select
                value={sequenceId}
                onChange={(e) => { setSequenceId(e.target.value); void save(license, e.target.value); }}
                className="max-w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-accent"
              >
                <option value="">— choisir (sinon : tâches) —</option>
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          {saving && <span className="text-[11px] text-slate-400">Enregistrement…</span>}
          {saved && !saving && <span className="text-[11px] font-medium text-emerald-600">✓ Enregistré</span>}
        </div>
      )}
      {proPlus && !loading && sequences.length === 0 && (
        <p className="mt-2 text-[11px] text-amber-600">
          {seqError
            ? `Séquences inaccessibles : ${seqError}`
            : "Aucune séquence trouvée sur le portail — crée une séquence de relance dans HubSpot (Automatisations → Séquences) pour activer l'envoi réel."}
        </p>
      )}
      {error && <p className="mt-2 text-[11px] text-rose-600">{error}</p>}
    </div>
  );
}
