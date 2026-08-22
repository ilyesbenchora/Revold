"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Modale d'ONBOARDING bloquante : s'ouvre dès l'arrivée sur la plateforme
 * quand la fiche de l'organisation est incomplète (nom, effectif, secteur) —
 * tous les champs sont OBLIGATOIRES, pas de fermeture sans enregistrer.
 * À l'enregistrement, tout s'active : l'organisation est créée/complétée en
 * base et les pages se rechargent avec l'org active.
 */

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const INDUSTRIES = [
  "SaaS / Tech",
  "Services B2B",
  "Industrie",
  "Commerce / Retail",
  "Finance / Assurance",
  "Santé",
  "Éducation",
  "Autre",
];

export function OrgSetupModal({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [employees, setEmployees] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_name: name.trim(), employees_range: employees, industry }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error ?? "Enregistrement impossible — réessaie.");
        return;
      }
      // L'org est active : re-rendu serveur de toute la plateforme.
      router.refresh();
    } catch {
      setError("Enregistrement impossible — réessaie.");
    } finally {
      setSaving(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-white p-6 shadow-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">Bienvenue sur Revold</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-900">Parle-nous de ton entreprise</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ces informations activent ton espace : elles servent au registre officiel, aux benchmarks et aux agents.
        </p>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
        )}

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="setup_org_name" className="mb-1 block text-xs font-medium text-slate-600">
              Nom de l&apos;entreprise <span className="text-rose-500">*</span>
            </label>
            <input
              id="setup_org_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="NovaTech SAS"
              className={field}
              required
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="setup_employees" className="mb-1 block text-xs font-medium text-slate-600">
              Nombre de salariés <span className="text-rose-500">*</span>
            </label>
            <select id="setup_employees" value={employees} onChange={(e) => setEmployees(e.target.value)} className={field} required>
              <option value="" disabled>Sélectionner…</option>
              {EMPLOYEE_RANGES.map((r) => (
                <option key={r} value={r}>{r} salariés</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="setup_industry" className="mb-1 block text-xs font-medium text-slate-600">
              Secteur d&apos;activité <span className="text-rose-500">*</span>
            </label>
            <select id="setup_industry" value={industry} onChange={(e) => setIndustry(e.target.value)} className={field} required>
              <option value="" disabled>Sélectionner…</option>
              {INDUSTRIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving || !name.trim() || !employees || !industry}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {saving ? "Activation de ton espace…" : "Activer mon espace Revold"}
          </button>
        </form>
      </div>
    </div>
  );
}
