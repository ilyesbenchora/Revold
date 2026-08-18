"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RevoldLogo } from "@/components/revold-logo";
import { loginAction, signupAction, googleAction } from "@/app/login/actions";

const STORAGE_KEY = "revold_remember_me";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-accent" />
      </main>
    }>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const checkEmail = searchParams.get("check_email") === "1";
  const isSignup = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load saved credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { email: savedEmail, password: savedPassword } = JSON.parse(saved);
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch {}
    setLoaded(true);
  }, []);

  // Save or clear credentials when rememberMe changes or form submits
  function handleSubmit(formData: FormData) {
    if (rememberMe) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, password }));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }

    if (isSignup) {
      signupAction(formData);
    } else {
      loginAction(formData);
    }
  }

  if (!loaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-accent" />
      </main>
    );
  }

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
            : "Accédez à votre plateforme d'intelligence revenus."}
        </p>

        {error && (
          <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {decodeURIComponent(error)}
          </div>
        )}

        {checkEmail && (
          <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-300">
            ✓ Compte créé. Vérifiez vos emails — un lien de confirmation vient d&apos;être envoyé.
            Cliquez dessus pour activer votre accès Revold.
          </div>
        )}

        {/* Connexion / inscription via Google (OAuth Supabase) */}
        <form action={googleAction} className="mt-8">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            {isSignup ? "S'inscrire avec Google" : "Continuer avec Google"}
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-slate-800" />
          <span className="text-[11px] uppercase tracking-wider text-slate-500">ou par email</span>
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form action={handleSubmit} className="mt-5 space-y-4">
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
              required
            />
          </div>

          {!isSignup && (
            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => {
                  setRememberMe(e.target.checked);
                  if (!e.target.checked) {
                    localStorage.removeItem(STORAGE_KEY);
                  }
                }}
                className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-accent focus:ring-accent/30"
              />
              <label htmlFor="remember" className="text-sm text-slate-400">
                Se souvenir de moi
              </label>
            </div>
          )}

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
