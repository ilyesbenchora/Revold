import Link from "next/link";

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-xl font-semibold text-slate-900">Page introuvable</h2>
      <p className="text-sm text-slate-600">Cette page n&apos;existe pas encore.</p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
      >
        Retour au dashboard
      </Link>
    </div>
  );
}
