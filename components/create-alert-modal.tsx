"use client";

import { useState } from "react";

const forecastTypes = [
  { id: "closing_rate", label: "Closing rate", description: "Taux de deals gagnés sur les deals clôturés", unit: "%", direction: "above" as const },
  { id: "conversion_rate", label: "Conversion Lead→Opp", description: "Taux de contacts convertis en opportunités", unit: "%", direction: "above" as const },
  { id: "pipeline_coverage", label: "Suivi pipeline", description: "% de deals avec une activité planifiée", unit: "%", direction: "above" as const },
  { id: "orphan_rate", label: "Taux d'orphelins", description: "% de contacts sans entreprise — objectif : descendre sous le seuil", unit: "%", direction: "below" as const },
  { id: "deal_activation", label: "Activation deals", description: "% de deals en cours avec au moins une activité", unit: "%", direction: "above" as const },
  { id: "phone_enrichment", label: "Enrichissement tél.", description: "% de contacts avec un numéro de téléphone", unit: "%", direction: "above" as const },
  { id: "pipeline_value", label: "Pipeline en valeur", description: "Montant total du pipeline ouvert", unit: "€", direction: "above" as const },
  { id: "dormant_reactivation", label: "Contacts dormants", description: "Nombre de contacts sans interaction depuis 6 mois", unit: "", direction: "below" as const },
];

export function CreateAlertModal() {
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [threshold, setThreshold] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [result, setResult] = useState<{ currentValue: number | null } | null>(null);

  const ft = forecastTypes.find((f) => f.id === selectedType);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ft || !threshold) return;

    setState("loading");
    try {
      const directionLabel = ft.direction === "below" ? "descendre sous" : "atteindre";
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${ft.label} : objectif ${threshold}${ft.unit}`,
          description: `Alerte quand le KPI "${ft.label}" va ${directionLabel} ${threshold}${ft.unit}. ${ft.description}.`,
          impact: `Notification automatique quand l'objectif de ${threshold}${ft.unit} sera atteint`,
          category: "sales",
          forecast_type: ft.id,
          threshold: Number(threshold),
          direction: ft.direction,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setResult({ currentValue: data.current_value });
        setState("done");
        setTimeout(() => {
          setOpen(false);
          setState("idle");
          setSelectedType("");
          setThreshold("");
          setResult(null);
        }, 3000);
      } else {
        setState("idle");
      }
    } catch {
      setState("idle");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v8" />
          <path d="M8 12h8" />
        </svg>
        Créer une alerte
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { if (state !== "loading") setOpen(false); }}>
          <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {state === "done" && result ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Alerte créée</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Revold surveille maintenant votre KPI en continu.
                </p>
                {result.currentValue != null && ft && (
                  <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Valeur actuelle</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {result.currentValue.toLocaleString("fr-FR")}{ft.unit}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Objectif : {ft.direction === "below" ? "descendre sous" : "atteindre"} {threshold}{ft.unit}
                    </p>
                  </div>
                )}
                <p className="mt-4 text-xs text-slate-400">
                  Vous recevrez une notification dans la cloche quand l&apos;objectif sera atteint.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-900">Créer une alerte personnalisée</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choisissez un KPI à surveiller et définissez votre objectif. Revold vérifie vos données en continu et vous notifie quand l&apos;objectif est atteint.
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">KPI à surveiller</label>
                    <div className="grid grid-cols-2 gap-2">
                      {forecastTypes.map((f) => (
                        <button
                          type="button"
                          key={f.id}
                          onClick={() => setSelectedType(f.id)}
                          className={`rounded-lg border px-3 py-2.5 text-left transition ${
                            selectedType === f.id
                              ? "border-accent bg-accent/5"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <span className={`block text-sm ${selectedType === f.id ? "font-medium text-accent" : "text-slate-700"}`}>
                            {f.label}
                          </span>
                          <span className="block text-[11px] text-slate-400 mt-0.5">{f.unit === "%" ? "En pourcentage" : f.unit === "€" ? "En euros" : "En nombre"}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {ft && (
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Objectif : {ft.direction === "below" ? "descendre sous" : "atteindre"}
                      </label>
                      <p className="mb-2 text-xs text-slate-400">{ft.description}</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={threshold}
                          onChange={(e) => setThreshold(e.target.value)}
                          placeholder="Ex: 35"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                        />
                        {ft.unit && (
                          <span className="text-sm font-medium text-slate-500">{ft.unit}</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedType || !threshold || state === "loading"}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
                    >
                      {state === "loading" ? "Création..." : "Créer l'alerte"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
