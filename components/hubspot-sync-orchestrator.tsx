"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type SyncStep = {
  label: string;
  type: string;
  status: "pending" | "running" | "done" | "error";
  count?: number;
  error?: string;
};

export function HubSpotSyncOrchestrator() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shouldSync = searchParams.get("hubspot") === "connected" || searchParams.get("sync") === "true";

  const [syncing, setSyncing] = useState(false);
  const [steps, setSteps] = useState<SyncStep[]>([
    { label: "Entreprises", type: "companies", status: "pending" },
    { label: "Contacts", type: "contacts", status: "pending" },
    { label: "Transactions", type: "deals", status: "pending" },
    { label: "Calcul des KPIs", type: "kpi", status: "pending" },
  ]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!shouldSync || syncing) return;
    setSyncing(true);
    runSync();
  }, [shouldSync]);

  async function runSync() {
    const types = ["companies", "contacts", "deals", "kpi"];

    for (let i = 0; i < types.length; i++) {
      setSteps((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s))
      );

      try {
        const res = await fetch(`/api/integrations/hubspot/sync?type=${types[i]}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          setSteps((prev) =>
            prev.map((s, idx) =>
              idx === i ? { ...s, status: "error", error: data.error || "Erreur" } : s
            )
          );
          continue;
        }

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "done", count: data.count } : s
          )
        );
      } catch (err) {
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "error", error: String(err) } : s
          )
        );
      }
    }

    setDone(true);
    // Reload after 2s to show fresh data
    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  if (!shouldSync && !syncing) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900">
          {done ? "Synchronisation terminée" : "Synchronisation HubSpot en cours..."}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {done
            ? "Vos données ont été importées. Redirection..."
            : "Import de vos données CRM. Cela peut prendre quelques secondes."}
        </p>

        <div className="mt-6 space-y-3">
          {steps.map((step) => (
            <div key={step.type} className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                {step.status === "pending" && (
                  <div className="h-3 w-3 rounded-full bg-slate-200" />
                )}
                {step.status === "running" && (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-500" />
                )}
                {step.status === "done" && (
                  <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {step.status === "error" && (
                  <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  step.status === "done" ? "text-emerald-700" :
                  step.status === "error" ? "text-red-700" :
                  step.status === "running" ? "text-slate-900" : "text-slate-400"
                }`}>
                  {step.label}
                  {step.status === "done" && step.count != null && (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {step.count.toLocaleString("fr-FR")} importés
                    </span>
                  )}
                </p>
                {step.status === "error" && step.error && (
                  <p className="text-xs text-red-500">{step.error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {done && (
          <div className="mt-6 rounded-lg bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700">
            Données synchronisées avec succès
          </div>
        )}
      </div>
    </div>
  );
}
