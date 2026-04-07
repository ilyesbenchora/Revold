import { RevoldLogo } from "@/components/revold-logo";
import { loginAction, signupAction } from "@/app/login/actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; mode?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, mode } = await searchParams;
  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <RevoldLogo tone="dark" />
        <h1 className="mt-6 text-2xl font-semibold text-white">
          {isSignup ? "Créer un compte" : "Connexion"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isSignup
            ? "Commencez à piloter votre revenue intelligence."
            : "Accédez à votre plateforme d\u2019intelligence revenue."}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form action={isSignup ? signupAction : loginAction} className="mt-8 space-y-4">
          {isSignup && (
            <>
              <div>
                <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-300">
                  Nom complet
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  placeholder="Jean Dupont"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                  required
                />
              </div>
              <div>
                <label htmlFor="org_name" className="mb-1 block text-sm font-medium text-slate-300">
                  Nom de l&apos;entreprise
                </label>
                <input
                  id="org_name"
                  name="org_name"
                  type="text"
                  placeholder="NovaTech SAS"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="vous@entreprise.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-300">
              Mot de passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {isSignup ? "Créer mon compte" : "Se connecter"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          {isSignup ? (
            <>
              Déjà un compte ?{" "}
              <a href="/login" className="text-accent hover:underline">
                Se connecter
              </a>
            </>
          ) : (
            <>
              Pas encore de compte ?{" "}
              <a href="/login?mode=signup" className="text-accent hover:underline">
                Créer un compte
              </a>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
