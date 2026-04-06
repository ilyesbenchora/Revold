import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SessionDebugPage() {
  let userId: string | null = null;
  let userEmail: string | null = null;
  let authError: string | null = null;
  let envError: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      authError = error.message;
    }

    userId = user?.id ?? null;
    userEmail = user?.email ?? null;
  } catch (error) {
    envError = error instanceof Error ? error.message : "Unknown Supabase configuration error";
  }

  const hasSession = Boolean(userId);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Debug session Supabase</h1>
        <p className="mt-1 text-sm text-slate-600">
          Cette page est temporaire et permet de vérifier l&apos;état réel de la session.
        </p>
      </header>

      <section className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">Session active:</span>
          <span
            className={`rounded-full px-2 py-1 text-xs font-semibold ${
              hasSession ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
            }`}
          >
            {hasSession ? "Oui" : "Non"}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-card-border bg-white p-3">
            <dt className="text-xs font-medium uppercase text-slate-500">User ID</dt>
            <dd className="mt-1 text-sm text-slate-900">{userId ?? "Aucun"}</dd>
          </div>
          <div className="rounded-lg border border-card-border bg-white p-3">
            <dt className="text-xs font-medium uppercase text-slate-500">Email</dt>
            <dd className="mt-1 text-sm text-slate-900">{userEmail ?? "Aucun"}</dd>
          </div>
        </dl>

        {authError && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Erreur Auth Supabase: {authError}
          </p>
        )}

        {envError && (
          <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Erreur configuration: {envError}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/login"
            className="rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Aller à /login
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Aller à /dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
