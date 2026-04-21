"use client";

/**
 * Wizard générique piloté par `WizardConfig`.
 *
 * Cohérent avec StripeWizard mais configurable pour tous les autres
 * outils. Une seule source de vérité sur le flux UX :
 *   - optional mode toggle (Live/Test/Prod/Sandbox)
 *   - steps numérotées avec deep-link / checklist / copyables / notes
 *   - fields avec validation temps-réel
 *   - submit qui passe au ping server-side avant activation
 */

import { useState } from "react";
import Link from "next/link";
import type { WizardConfig, KeyFeedback } from "@/lib/integrations/wizard-configs";

type Props = {
  toolKey: string;
  toolLabel: string;
  config: WizardConfig;
  alreadyConnected: boolean;
  submitAction: (formData: FormData) => void | Promise<void>;
  disconnectAction: () => void | Promise<void>;
  errorMessage: string | null;
  errorReason: string | null;
};

export function GenericConnectWizard({
  toolKey: _toolKey,
  toolLabel,
  config,
  alreadyConnected,
  submitAction,
  disconnectAction,
  errorMessage,
  errorReason,
}: Props) {
  const [mode, setMode] = useState<string>(config.modeToggle?.defaultKey ?? "default");
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const steps = config.buildSteps(mode);
  const bgClass = config.brandColor?.bg ?? "bg-accent";
  const hoverClass = config.brandColor?.hover ?? "hover:bg-indigo-500";

  function setField(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 1500);
    } catch {}
  }

  // Est-ce que tous les champs required sont remplis + valides ?
  const allValid = config.fields.every((f) => {
    const v = (values[f.key] ?? "").trim();
    if (!v) return false;
    if (f.validate) {
      const fb = f.validate(v);
      if (fb?.severity === "error") return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Erreur serveur (retour du ping) */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{errorMessage}</p>
          {errorReason && <p className="mt-1 text-xs text-red-600">{errorReason}</p>}
        </div>
      )}

      {/* Mode toggle (optionnel) */}
      {config.modeToggle && (
        <ModeToggleBlock
          toggle={config.modeToggle}
          current={mode}
          onChange={setMode}
        />
      )}

      {/* Steps */}
      {steps.map((step, i) => (
        <Step key={i} number={i + 1} title={step.title}>
          {step.body && <p className="text-xs text-slate-600">{step.body}</p>}

          {step.deepLink && (
            <a
              href={step.deepLink.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-flex items-center gap-2 rounded-lg ${bgClass} ${hoverClass} px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              {step.deepLink.label}
            </a>
          )}

          {step.copyables && step.copyables.length > 0 && (
            <div className="mt-3 space-y-2">
              {step.copyables.map((c, idx) => {
                const key = `${i}-${idx}`;
                const isCopied = copiedKey === key;
                return (
                  <div key={key} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.label}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800">
                        {c.value}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(c.value, key)}
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
                      >
                        {isCopied ? "✓ Copié" : "Copier"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step.checklist && step.checklist.length > 0 && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Cases à cocher (toutes en READ uniquement)
              </p>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {step.checklist.map((c) => (
                  <li key={c.label} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-[10px] font-bold text-white">
                      ✓
                    </span>
                    <div>
                      <span className="font-medium">{c.label}</span>{" "}
                      <span className="text-slate-500">→ READ</span>
                      {c.reason && <p className="text-[10px] text-slate-500">{c.reason}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step.notes && step.notes.length > 0 && (
            <ul className="mt-3 space-y-1">
              {step.notes.map((n, idx) => (
                <li key={idx} className="text-[11px] text-slate-600">
                  • {n}
                </li>
              ))}
            </ul>
          )}
        </Step>
      ))}

      {/* Étape finale : formulaire de collage */}
      <Step number={steps.length + 1} title={`Collez ${config.fields.length === 1 ? "la valeur" : "les valeurs"} dans Revold`}>
        <form action={submitAction} className="space-y-3">
          {config.fields.map((field) => {
            const raw = values[field.key] ?? "";
            const feedback: KeyFeedback | null = field.validate ? field.validate(raw.trim()) : null;
            const isPwd = field.type === "password";
            const shown = revealed[field.key] ?? false;

            return (
              <div key={field.key}>
                <label htmlFor={field.key} className="block text-xs font-medium text-slate-700">
                  {field.label}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id={field.key}
                    name={field.key}
                    type={isPwd && !shown ? "password" : "text"}
                    value={raw}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    required
                    autoComplete="off"
                    spellCheck={false}
                    className={`flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent ${
                      field.monospace ? "font-mono" : ""
                    }`}
                  />
                  {isPwd && (
                    <button
                      type="button"
                      onClick={() => setRevealed((r) => ({ ...r, [field.key]: !r[field.key] }))}
                      className="rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {shown ? "Masquer" : "Afficher"}
                    </button>
                  )}
                </div>
                {field.helper && !feedback && (
                  <p className="mt-1 text-[11px] text-slate-500">{field.helper}</p>
                )}
                {feedback && (
                  <FeedbackBadge feedback={feedback} />
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[10px] text-slate-400">
              🔒 Stocké chiffré dans Supabase · validation côté serveur avant activation.
            </p>
            <button
              type="submit"
              disabled={!allValid}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {alreadyConnected ? "Mettre à jour" : `Connecter ${toolLabel}`}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </form>
      </Step>

      {alreadyConnected && (
        <form action={disconnectAction} className="border-t border-slate-200 pt-4">
          <button
            type="submit"
            className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
          >
            Déconnecter {toolLabel}
          </button>
        </form>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
        <p className="font-semibold text-slate-800">Besoin d&apos;aide ?</p>
        <p className="mt-1">
          <Link href="/dashboard/integration" className="text-accent hover:underline">
            ← Revenir aux intégrations
          </Link>
          {" · "}
          <a
            href={config.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Documentation officielle {toolLabel}
          </a>
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="mt-2 pl-8">{children}</div>
    </div>
  );
}

function ModeToggleBlock({
  toggle,
  current,
  onChange,
}: {
  toggle: NonNullable<WizardConfig["modeToggle"]>;
  current: string;
  onChange: (key: string) => void;
}) {
  const selected = toggle.options.find((o) => o.key === current);
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    indigo: "bg-indigo-500",
  };
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200">
      <div>
        <p className="text-xs font-semibold text-slate-800">{toggle.label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{selected?.description}</p>
      </div>
      <div className="flex rounded-md bg-white p-0.5 ring-1 ring-slate-200">
        {toggle.options.map((opt) => {
          const active = current === opt.key;
          const bg = colorMap[opt.color] ?? "bg-slate-500";
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(opt.key)}
              className={`rounded px-3 py-1 text-xs font-semibold transition ${
                active ? `${bg} text-white` : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackBadge({ feedback }: { feedback: KeyFeedback }) {
  const cls =
    feedback.severity === "error"
      ? "border border-red-200 bg-red-50 text-red-700"
      : feedback.severity === "warning"
      ? "border border-amber-200 bg-amber-50 text-amber-800"
      : "border border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div className={`mt-2 rounded-md px-3 py-2 text-[11px] ${cls}`}>
      <p className="font-semibold">{feedback.title}</p>
      {feedback.body && <p className="mt-0.5">{feedback.body}</p>}
    </div>
  );
}
