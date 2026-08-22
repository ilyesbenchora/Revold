"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { POLE_OPTIONS } from "@/lib/workspaces";

/**
 * Modale d'ONBOARDING bloquante, en DEUX ÉTAPES — s'ouvre dès l'arrivée sur
 * la plateforme quand la fiche de l'organisation est incomplète :
 *   1. Entreprise : nom (saisi par l'utilisateur), effectif, secteur.
 *   2. Équipe & rôle : pôle de travail + rôle — le CRÉATEUR de l'espace reste
 *      Admin (forcé côté serveur s'il est le seul membre : une org sans admin
 *      serait ingérable).
 * Tous les champs sont OBLIGATOIRES, pas de fermeture sans enregistrer.
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
const ROLES = [
  { value: "admin", label: "Admin — gestion complète de l'espace" },
  { value: "manager", label: "Manager — équipe + données" },
  { value: "rep", label: "Commercial — lecture + alertes" },
];

export function OrgSetupModal({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  // Étape 1 — entreprise.
  const [name, setName] = useState(initialName);
  const [employees, setEmployees] = useState("");
  const [industry, setIndustry] = useState("");
  // Étape 2 — équipe & rôle. "" = tous les espaces (direction / transverse).
  const [pole, setPole] = useState<string | null>(null);
  const [role, setRole] = useState("admin");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step1Ok = Boolean(name.trim() && employees && industry);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || pole === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_name: name.trim(),
          employees_range: employees,
          industry,
          pole,
          role,
        }),
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
    // id stable : FeatureTour retient ses tutoriels tant que cette modale est
    // dans le DOM (ils démarrent une fois le formulaire validé).
    <div id="org-setup-modal" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-card-border bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-500">Bienvenue sur Revold</p>
          <span className="text-[11px] font-medium text-slate-400">Étape {step} / 2</span>
        </div>
        {/* Progression */}
        <div className="mt-2 flex gap-1.5">
          <span className="h-1 flex-1 rounded-full bg-accent" />
          <span className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-accent" : "bg-slate-200"}`} />
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
        )}

        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step1Ok) setStep(2);
            }}
            className="mt-4 space-y-3"
          >
            <h2 className="text-lg font-semibold text-slate-900">Parle-nous de ton entreprise</h2>
            <p className="text-sm text-slate-500">
              Ces informations activent ton espace : registre officiel, benchmarks et agents.
            </p>
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
              disabled={!step1Ok}
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              Continuer
            </button>
          </form>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">Ton équipe et ton rôle</h2>
            <p className="text-sm text-slate-500">
              L&apos;équipe définit ton espace de travail (pages, cohortes, récaps) ; le rôle définit tes droits.
            </p>
            <div>
              <label htmlFor="setup_pole" className="mb-1 block text-xs font-medium text-slate-600">
                Ton équipe <span className="text-rose-500">*</span>
              </label>
              <select
                id="setup_pole"
                value={pole ?? ""}
                onChange={(e) => setPole(e.target.value)}
                className={field}
                required
              >
                <option value="" disabled hidden={pole !== null}>Sélectionner…</option>
                {/* CEO / direction : accès à tous les espaces de travail. Pas d'icônes. */}
                <option value="all">Tous les espaces (CEO / direction)</option>
                {POLE_OPTIONS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="setup_role" className="mb-1 block text-xs font-medium text-slate-600">
                Ton rôle <span className="text-rose-500">*</span>
              </label>
              <select id="setup_role" value={role} onChange={(e) => setRole(e.target.value)} className={field} required>
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400">
                Créateur de l&apos;espace : tu restes Admin tant qu&apos;aucun autre admin n&apos;existe (une
                organisation sans admin serait ingérable).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                ← Retour
              </button>
              <button
                type="submit"
                disabled={saving || pole === null}
                className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? "Activation de ton espace…" : "Activer mon espace Revold"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
