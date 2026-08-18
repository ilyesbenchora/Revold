"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { RevoldLogo } from "@/components/revold-logo";
import {
  loginAction,
  signupAction,
  googleAction,
  emailOtpAction,
  verifyOtpAction,
  completeProfileAction,
} from "@/app/login/actions";

const EMPLOYEE_RANGES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const INDUSTRIES = [
  "SaaS / Tech",
  "Services B2B",
  "Industrie",
  "Commerce / Retail",
  "Finance / Assurance",
  "Santé",
  "Éducation",
  "Autre",
];

// Ancienne case « Se souvenir de moi » : stockait email + mot de passe en
// CLAIR dans le localStorage. Retirée au profit du gestionnaire de mots de
// passe du navigateur (chiffré, synchronisé) ; on purge l'ancien stockage.
const LEGACY_STORAGE_KEY = "revold_remember_me";

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
  const mode = searchParams.get("mode");
  const isSignup = mode === "signup";
  // Formulaire mot de passe affiché seulement à la demande (ou en signup) —
  // l'entrée par défaut est Google / code email.
  const passwordMode = mode === "password" || isSignup;
  const otpMode = mode === "otp";
  const entrepriseMode = mode === "entreprise";
  const otpEmail = searchParams.get("email") ?? "";
  // "1" = compte déjà existant (le code connecte, ne crée rien) · "0" = nouveau.
  const existingAccount = searchParams.get("existing") ?? "";
  // Fin d'inscription après Google : mot de passe optionnel (Google suffit).
  const oauthSignup = searchParams.get("oauth") === "1";

  // Purge de l'ancien stockage en clair (utilisateurs existants).
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
        <RevoldLogo tone="dark" />
        <h1 className="mt-6 text-2xl font-semibold text-white">
          {entrepriseMode
            ? "Bienvenue sur Revold"
            : otpMode
              ? "Vérifie tes emails"
              : isSignup
                ? "Créer un compte"
                : "Connexion"}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {entrepriseMode
            ? "Encore quelques informations sur ton entreprise et c'est parti."
            : otpMode
              ? `Un code à 6 chiffres vient d'être envoyé à ${otpEmail || "ton adresse"}.`
              : isSignup
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

        {/* ── Étape entreprise (fin d'inscription par email) ── */}
        {entrepriseMode && (
          <form action={completeProfileAction} className="mt-8 space-y-4">
            {/* Email en lecture seule (autocomplete username) : associe le
                mot de passe au compte → le navigateur propose de l'enregistrer
                pour les prochaines connexions email + mot de passe. */}
            {otpEmail && (
              <div>
                <label htmlFor="signup_email" className="mb-1 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="signup_email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  value={otpEmail}
                  readOnly
                  className="w-full cursor-default rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-400 outline-none"
                />
              </div>
            )}
            <div>
              <label htmlFor="org_name" className="mb-1 block text-sm font-medium text-slate-300">
                Nom de l&apos;entreprise <span className="text-rose-400">*</span>
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
            <div>
              <label htmlFor="employees_range" className="mb-1 block text-sm font-medium text-slate-300">
                Nombre de salariés <span className="text-rose-400">*</span>
              </label>
              <select
                id="employees_range"
                name="employees_range"
                defaultValue=""
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                required
              >
                <option value="" disabled>Sélectionner…</option>
                {EMPLOYEE_RANGES.map((r) => (
                  <option key={r} value={r}>{r} salariés</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="industry" className="mb-1 block text-sm font-medium text-slate-300">
                Secteur d&apos;activité <span className="text-rose-400">*</span>
              </label>
              <select
                id="industry"
                name="industry"
                defaultValue=""
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                required
              >
                <option value="" disabled>Sélectionner…</option>
                {INDUSTRIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Parcours Google (oauth=1) : le mot de passe est optionnel — la
                connexion Google suffit pour les prochaines fois. */}
            <input type="hidden" name="oauth" value={oauthSignup ? "1" : ""} />
            <div>
              <label htmlFor="new_password" className="mb-1 block text-sm font-medium text-slate-300">
                Choisis un mot de passe{" "}
                {oauthSignup ? <span className="text-slate-500">(optionnel)</span> : <span className="text-rose-400">*</span>}
              </label>
              <input
                id="new_password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={oauthSignup ? undefined : 8}
                placeholder="8 caractères minimum"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                required={!oauthSignup}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {oauthSignup
                  ? "Optionnel — tu pourras continuer à te connecter avec Google."
                  : "Pour tes prochaines connexions — le code par email restera aussi disponible."}
              </p>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Accéder à Revold
            </button>
          </form>
        )}

        {/* ── Étape code de vérification (6 chiffres) ── */}
        {otpMode && !entrepriseMode && (
          <>
            {/* Compte déjà existant détecté côté serveur : on le DIT — le code
                connecte au compte existant, aucun doublon ne sera créé. */}
            {existingAccount === "1" && (
              <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
                Un compte Revold existe déjà avec cet email — le code à 6 chiffres te
                <span className="font-semibold"> connecte à ton compte existant</span>, aucun nouveau compte ne sera créé.
              </div>
            )}
            {existingAccount === "0" && (
              <p className="mt-4 text-xs text-slate-500">
                Aucun compte avec cet email : ton compte sera créé après vérification du code.
              </p>
            )}
            <form action={verifyOtpAction} className="mt-8 space-y-4">
              <input type="hidden" name="email" value={otpEmail} />
              <div>
                <label htmlFor="code" className="mb-1 block text-sm font-medium text-slate-300">
                  Code de vérification
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="••••••"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-center text-2xl tracking-[0.5em] text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Continuer
              </button>
            </form>
            <form action={emailOtpAction} className="mt-4 text-center">
              <input type="hidden" name="email" value={otpEmail} />
              <button type="submit" className="text-sm text-slate-500 transition hover:text-slate-300">
                Renvoyer le code
              </button>
              <span className="mx-2 text-slate-700">·</span>
              <a href="/login" className="text-sm text-slate-500 transition hover:text-slate-300">
                Changer d&apos;email
              </a>
            </form>
          </>
        )}

        {/* Connexion / inscription via Google (OAuth Supabase) */}
        {!otpMode && !entrepriseMode && (
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
        )}

        {!otpMode && !entrepriseMode && (
          <div className="mt-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-slate-800" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500">ou inscription par email</span>
            <span className="h-px flex-1 bg-slate-800" />
          </div>
        )}

        {/* ── Entrée par défaut : email → code de vérification à 6 chiffres ── */}
        {!otpMode && !entrepriseMode && !passwordMode && (
          <>
            <form action={emailOtpAction} className="mt-5 space-y-4">
              <div>
                <label htmlFor="otp_email" className="mb-1 block text-sm font-medium text-slate-300">
                  Email
                </label>
                <input
                  id="otp_email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="vous@entreprise.com"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                S&apos;inscrire par email
              </button>
              <p className="text-center text-[11px] text-slate-500">
                Déjà un compte ? Le code par email te connecte aussi, sans créer de doublon.
              </p>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Déjà inscrit ?{" "}
              <a href="/login?mode=password" className="text-accent hover:underline">
                Se connecter avec un mot de passe
              </a>
            </p>
          </>
        )}

        {passwordMode && (
        <form action={isSignup ? signupAction : loginAction} className="mt-5 space-y-4">
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
              autoComplete="username"
              placeholder="vous@entreprise.com"
              // Prérempli quand on arrive d'une inscription bloquée (compte déjà existant).
              defaultValue={otpEmail}
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
              autoComplete="current-password"
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
        )}

        {passwordMode && (
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
                <span className="mx-2 text-slate-700">·</span>
                <a href="/login" className="text-accent hover:underline">
                  Code par email
                </a>
              </>
            )}
          </p>
        )}
      </section>
    </main>
  );
}
