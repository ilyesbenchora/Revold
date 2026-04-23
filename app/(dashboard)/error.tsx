"use client";

import { useEffect, useState } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  // En prod, error.message est masqué par React (security). On loggue ici
  // au moins le digest côté client pour aider au diagnostic via Vercel.
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.error("[DashboardError]", {
        message: error.message,
        digest: error.digest,
        stack: error.stack,
      });
    }
  }, [error]);

  async function copyDigest() {
    if (!error.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 py-16 text-center">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Une erreur est survenue</h2>
        <p className="mt-1 text-sm text-slate-600">
          {error.message && error.message !== "An error occurred in the Server Components render."
            ? error.message
            : "Une erreur côté serveur a interrompu le chargement de cette page."}
        </p>
      </div>

      {error.digest && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Identifiant d&apos;erreur (à fournir au support)
          </p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs text-slate-800 ring-1 ring-slate-200">
              {error.digest}
            </code>
            <button
              type="button"
              onClick={copyDigest}
              className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-white"
            >
              {copied ? "✓ Copié" : "Copier"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            En production, React masque le détail technique. Cet identifiant
            permet de retrouver la stack complète dans les logs Vercel.
          </p>
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Retour à l&apos;accueil
        </a>
      </div>
    </div>
  );
}
