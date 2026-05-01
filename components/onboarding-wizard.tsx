"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnboardingState } from "@/lib/onboarding/state";

const OBJECTIVES = [
  { key: "sales", label: "Ventes", emoji: "💼", desc: "Pipeline, deals, closing rate, forecast" },
  { key: "marketing", label: "Marketing", emoji: "📢", desc: "Funnel acquisition, MQL/SQL, formulaires, campagnes" },
  { key: "revenue", label: "Revenue / Finance", emoji: "💰", desc: "MRR, ARR, churn, paiements, recouvrement" },
  { key: "service", label: "Service Client", emoji: "🎧", desc: "Tickets, satisfaction, signaux churn" },
];

type Props = {
  initial: OnboardingState;
  hubspotConnectedAtFromIntegration: string | null;
  hasFirstSync: boolean;
};

export function OnboardingWizard({ initial, hubspotConnectedAtFromIntegration, hasFirstSync }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-détection : si HubSpot connecté détecté ailleurs, on considère cette étape OK
  const hubspotDone = !!(initial.hubspotConnectedAt || hubspotConnectedAtFromIntegration);
  const firstSyncDone = !!(initial.firstSyncSeenAt || hasFirstSync);

  const computeStep = (): number => {
    if (!initial.welcomedAt) return 1;
    if (!hubspotDone) return 2;
    if (!initial.objectivesSetAt) return 3;
    if (!firstSyncDone) return 4;
    return 5;
  };
  const [step, setStep] = useState<number>(computeStep());
  const [objectives, setObjectives] = useState<string[]>(initial.objectives);

  async function patch(body: object) {
    const res = await fetch("/api/onboarding/state", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Erreur");
      return false;
    }
    return true;
  }

  async function nextStep(stepKey: string, payload: object = {}) {
    setBusy(stepKey);
    setError(null);
    const ok = await patch({ step: stepKey, ...payload });
    setBusy(null);
    if (ok) {
      startTransition(() => {
        router.refresh();
        setStep((s) => s + 1);
      });
    }
  }

  async function skip() {
    if (!confirm("Sauter l'onboarding ? Vous pourrez le reprendre depuis le Dashboard.")) return;
    setBusy("skip");
    await patch({ skip: true });
    setBusy(null);
    router.push("/dashboard");
  }

  async function complete() {
    setBusy("complete");
    await patch({ step: "completed" });
    setBusy(null);
    router.push("/dashboard");
  }

  const totalSteps = 4;
  const progress = Math.min(step - 1, totalSteps);
  const progressPct = Math.round((progress / totalSteps) * 100);

  return (
    <section className="mx-auto max-w-2xl space-y-8 px-4 py-12">
      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Étape {Math.min(step, totalSteps)} sur {totalSteps}
          </p>
          <button
            type="button"
            onClick={skip}
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            Faire ça plus tard →
          </button>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      {/* STEP 1 — Bienvenue */}
      {step === 1 && (
        <div className="card p-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-2xl">
            👋
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Bienvenue sur Revold</h1>
          <p className="mt-2 text-sm text-slate-600">
            Quatre étapes pour activer votre Revenue Intelligence — moins de 5 minutes.
            Vous verrez votre premier insight à la fin.
          </p>
          <ol className="mt-6 space-y-3 text-left text-sm text-slate-700">
            <li className="flex gap-2"><span className="font-semibold text-accent">1.</span> Connecter HubSpot (1 clic)</li>
            <li className="flex gap-2"><span className="font-semibold text-slate-400">2.</span> Choisir vos équipes & objectifs</li>
            <li className="flex gap-2"><span className="font-semibold text-slate-400">3.</span> Premier sync de vos données</li>
            <li className="flex gap-2"><span className="font-semibold text-slate-400">4.</span> Voir votre 1er insight</li>
          </ol>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => nextStep("welcomed")}
            className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "welcomed" ? "…" : "Commencer"}
          </button>
        </div>
      )}

      {/* STEP 2 — HubSpot */}
      {step === 2 && (
        <div className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Étape 2</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Connectez HubSpot</h2>
          <p className="mt-2 text-sm text-slate-600">
            Revold lit vos contacts, deals, factures et tickets pour générer vos insights.
            Aucune donnée n&apos;est modifiée dans HubSpot.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/dashboard/integration/connect/hubspot"
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90"
            >
              🔗 Connecter HubSpot via OAuth
            </Link>
            <button
              type="button"
              onClick={() => nextStep("hubspot")}
              disabled={busy !== null}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {busy === "hubspot" ? "…" : hubspotDone ? "C'est fait, étape suivante →" : "Sauter pour l'instant"}
            </button>
          </div>
          <p className="mt-4 text-[11px] text-slate-400">
            🔒 Hébergement EU (Frankfurt), tokens chiffrés au repos. <Link href="/legal/securite" target="_blank" className="underline">Voir notre politique de sécurité</Link>.
          </p>
        </div>
      )}

      {/* STEP 3 — Objectives */}
      {step === 3 && (
        <div className="card p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Étape 3</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Vos équipes & objectifs</h2>
          <p className="mt-2 text-sm text-slate-600">
            Pour quelles équipes voulez-vous activer Revold ? On pré-configurera votre dashboard
            en conséquence.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {OBJECTIVES.map((o) => {
              const active = objectives.includes(o.key);
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() =>
                    setObjectives((prev) =>
                      prev.includes(o.key) ? prev.filter((k) => k !== o.key) : [...prev, o.key],
                    )
                  }
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                    active
                      ? "border-accent bg-accent/5"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <span className="text-2xl">{o.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{o.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{o.desc}</p>
                  </div>
                  {active && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-accent shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => nextStep("objectives", { objectives })}
            disabled={busy !== null || objectives.length === 0}
            className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === "objectives" ? "…" : `Continuer (${objectives.length} sélectionné${objectives.length > 1 ? "s" : ""})`}
          </button>
        </div>
      )}

      {/* STEP 4 — Premier sync */}
      {step === 4 && (
        <div className="card p-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Étape 4</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Premier sync de vos données</h2>
          <p className="mt-2 text-sm text-slate-600">
            {hasFirstSync
              ? "✓ Vos données sont synchronisées. Prêt à voir votre premier insight."
              : "Le sync HubSpot tourne en arrière-plan. Vous pouvez attendre ou avancer — vous verrez les données dès qu'elles seront prêtes."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {!hasFirstSync && (
              <Link
                href="/dashboard/parametres/integrations"
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Voir l&apos;état du sync
              </Link>
            )}
            <button
              type="button"
              onClick={() => nextStep("first_sync")}
              disabled={busy !== null}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
            >
              {busy === "first_sync" ? "…" : "Continuer →"}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5 — Final */}
      {step >= 5 && (
        <div className="card p-8 text-center">
          <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-2xl">
            🎉
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-900">Vous êtes prêt</h2>
          <p className="mt-2 text-sm text-slate-600">
            Votre Revenue Intelligence est active. Direction votre 1er insight.
          </p>
          <button
            type="button"
            onClick={complete}
            disabled={busy !== null}
            className="mt-6 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-6 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy === "complete" ? "…" : "Voir mon 1er insight →"}
          </button>
        </div>
      )}
    </section>
  );
}
