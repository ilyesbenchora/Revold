"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-xl font-semibold text-slate-900">Une erreur est survenue</h2>
      <p className="text-sm text-slate-600">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Réessayer
      </button>
    </div>
  );
}
