"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RevoldLogo } from "@/components/revold-logo";
import { loginAction, signupAction } from "@/app/login/actions";

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

        <form action={handleSubmit} className="mt-8 space-y-4">
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
