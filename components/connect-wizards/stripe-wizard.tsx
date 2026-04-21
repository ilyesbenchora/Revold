/**
 * Stripe connect wizard — pas-à-pas pour utilisateurs non-techniques.
 *
 * Flow :
 *   1. Clic sur le bouton deep-link → ouvre dashboard.stripe.com/apikeys/create
 *      (mode live par défaut, toggle vers /test/ si l'user veut tester sans risque)
 *   2. Liste des permissions exactes à cocher côté Stripe (toutes en READ)
 *   3. Collage de la clé rk_live_… / rk_test_… dans le champ ; le ping valide
 *      avant activation et retourne un message précis si pk_/sk_/whsec_.
 *
 * Le wizard soumet à la même server action que le formulaire générique
 * (connectToolAction) — on change juste la présentation.
 */

"use client";

import { useState } from "react";
import Link from "next/link";

type WizardProps = {
  toolKey: string;
  alreadyConnected: boolean;
  submitAction: (formData: FormData) => void | Promise<void>;
  disconnectAction: () => void | Promise<void>;
  errorMessage: string | null;
  errorReason: string | null;
};

const STRIPE_LIVE_CREATE = "https://dashboard.stripe.com/apikeys/create";
const STRIPE_TEST_CREATE = "https://dashboard.stripe.com/test/apikeys/create";
const STRIPE_LIVE_LIST = "https://dashboard.stripe.com/apikeys";
const STRIPE_TEST_LIST = "https://dashboard.stripe.com/test/apikeys";

const SUGGESTED_NAME = "Revold (lecture seule)";

const REQUIRED_READ_RESOURCES = [
  { label: "Customers", reason: "Identifier les clients pour le matching HubSpot" },
  { label: "Charges", reason: "Détecter les paiements et les paiements échoués" },
  { label: "Invoices", reason: "Réconcilier deals gagnés ↔ factures émises" },
  { label: "Subscriptions", reason: "Calculer MRR, ARR, NRR, churn" },
  { label: "Payment Intents", reason: "Suivre les tentatives de paiement" },
  { label: "Balance", reason: "Smoke test du ping (permission la plus petite)" },
  { label: "Products", reason: "Catalogue pour l'analyse par produit" },
  { label: "Prices", reason: "Upsell / cross-sell par tier de prix" },
];

export function StripeWizard({
  toolKey: _toolKey,
  alreadyConnected,
  submitAction,
  disconnectAction,
  errorMessage,
  errorReason,
}: WizardProps) {
  const [mode, setMode] = useState<"live" | "test">("live");
  const [keyValue, setKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const createUrl = mode === "live" ? STRIPE_LIVE_CREATE : STRIPE_TEST_CREATE;
  const listUrl = mode === "live" ? STRIPE_LIVE_LIST : STRIPE_TEST_LIST;

  // ── Détection temps-réel du type de clé collée ──
  const trimmed = keyValue.trim();
  const keyInfo = detectKeyType(trimmed);

  async function copyName() {
    try {
      await navigator.clipboard.writeText(SUGGESTED_NAME);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="space-y-5">
      {/* Erreur serveur (retour du ping) */}
      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">{errorMessage}</p>
          {errorReason && <p className="mt-1 text-xs text-red-600">{errorReason}</p>}
        </div>
      )}

      {/* Toggle Live / Test */}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 ring-1 ring-slate-200">
        <div>
          <p className="text-xs font-semibold text-slate-800">Mode de connexion</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {mode === "test"
              ? "Mode test : aucune donnée de prod touchée — idéal pour valider le flow."
              : "Mode live : vos vraies données (lecture seule, aucune écriture)."}
          </p>
        </div>
        <div className="flex rounded-md bg-white p-0.5 ring-1 ring-slate-200">
          <button
            type="button"
            onClick={() => setMode("live")}
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              mode === "live" ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => setMode("test")}
            className={`rounded px-3 py-1 text-xs font-semibold transition ${
              mode === "test" ? "bg-amber-500 text-white" : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Test
          </button>
        </div>
      </div>

      {/* Étape 1 */}
      <Step number={1} title="Ouvrez Stripe dans un nouvel onglet">
        <p className="text-xs text-slate-600">
          Le bouton ci-dessous ouvre directement la page de création d&apos;une nouvelle clé{" "}
          {mode === "test" ? "de test" : "live"} dans votre dashboard Stripe. Vous resterez connecté(e) à vos identifiants Stripe habituels.
        </p>
        <a
          href={createUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4F45FF]"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Ouvrir Stripe → Créer ma clé {mode === "test" ? "(test)" : "(live)"}
        </a>
        <p className="mt-2 text-[11px] text-slate-400">
          Déjà une clé Revold créée ?{" "}
          <a href={listUrl} target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
            Voir mes clés existantes
          </a>
        </p>
      </Step>

      {/* Étape 2 */}
      <Step number={2} title="Configurez la Restricted Key">
        <p className="text-xs text-slate-600">
          Sur la page Stripe qui vient d&apos;ouvrir, configurez la clé ainsi :
        </p>

        <div className="mt-3 space-y-3">
          {/* Nom suggéré */}
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">① Nom de la clé</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs font-mono text-slate-800">
                {SUGGESTED_NAME}
              </code>
              <button
                type="button"
                onClick={copyName}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200"
              >
                {copied ? "✓ Copié" : "Copier"}
              </button>
            </div>
          </div>

          {/* Permissions à cocher */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              ② Permissions à cocher (toutes en READ uniquement)
            </p>
            <p className="mt-1 text-[11px] text-emerald-700">
              Dans la section &laquo; Permissions &raquo;, sélectionnez <strong>Read</strong> pour
              chaque ressource ci-dessous. Laissez tout le reste sur &laquo; None &raquo;.
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {REQUIRED_READ_RESOURCES.map((r) => (
                <li key={r.label} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm bg-emerald-600 text-[10px] font-bold text-white">
                    ✓
                  </span>
                  <div>
                    <span className="font-medium">{r.label}</span>{" "}
                    <span className="text-slate-500">→ READ</span>
                    <p className="text-[10px] text-slate-500">{r.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-slate-500">
            ③ Cliquez sur <strong>&laquo; Create key &raquo;</strong> en bas de la page Stripe.
          </p>
          <p className="text-[11px] text-slate-500">
            ④ Stripe affiche la clé une seule fois. <strong>Copiez-la immédiatement</strong>{" "}
            (elle commence par <code className="rounded bg-slate-100 px-1">rk_{mode === "test" ? "test" : "live"}_</code>…).
          </p>
        </div>
      </Step>

      {/* Étape 3 — paste & submit */}
      <Step number={3} title="Collez la clé dans Revold">
        <form action={submitAction} className="space-y-3">
          <div>
            <label htmlFor="secret_key" className="block text-xs font-medium text-slate-700">
              Restricted Key Stripe
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="secret_key"
                name="secret_key"
                type={showKey ? "text" : "password"}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder={`rk_${mode === "test" ? "test" : "live"}_•••••••••••`}
                required
                autoComplete="off"
                spellCheck={false}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                className="rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {showKey ? "Masquer" : "Afficher"}
              </button>
            </div>

            {/* Feedback temps-réel */}
            {keyInfo && (
              <div className={`mt-2 rounded-md px-3 py-2 text-[11px] ${keyInfo.className}`}>
                <p className="font-semibold">{keyInfo.title}</p>
                {keyInfo.body && <p className="mt-0.5">{keyInfo.body}</p>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[10px] text-slate-400">
              🔒 Stockée chiffrée dans Supabase · lecture seule · révocable à tout moment côté Stripe.
            </p>
            <button
              type="submit"
              disabled={!trimmed || (keyInfo?.severity === "error")}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {alreadyConnected ? "Mettre à jour" : "Connecter Stripe"}
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
            Déconnecter Stripe
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
            href="https://docs.stripe.com/keys#create-restricted-api-secret-key"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            Documentation Stripe officielle
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

type KeyFeedback = {
  severity: "error" | "warning" | "ok";
  title: string;
  body?: string;
  className: string;
};

function detectKeyType(key: string): KeyFeedback | null {
  if (!key) return null;
  if (key.startsWith("pk_")) {
    return {
      severity: "error",
      title: "❌ C'est une Publishable Key, pas une clé serveur.",
      body: "Stripe a deux clés : celle-ci est publique et inutilisable côté Revold. Utilisez une Secret ou Restricted Key (sk_… ou rk_…).",
      className: "border border-red-200 bg-red-50 text-red-700",
    };
  }
  if (key.startsWith("whsec_")) {
    return {
      severity: "error",
      title: "❌ C'est un secret de webhook, pas une clé API.",
      body: "Allez dans Developers → API keys (et non pas Webhooks) pour créer la bonne clé.",
      className: "border border-red-200 bg-red-50 text-red-700",
    };
  }
  if (key.startsWith("rk_test_") || key.startsWith("sk_test_")) {
    return {
      severity: "warning",
      title: "⚠️ Mode test détecté — parfait pour valider le flow.",
      body: "Les données synchronisées seront vos données test Stripe (pas la prod). Vous pourrez basculer en live quand vous voudrez.",
      className: "border border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  if (key.startsWith("rk_live_") || key.startsWith("sk_live_")) {
    return {
      severity: "ok",
      title: "✓ Clé live détectée (lecture seule).",
      body: "Cliquez sur « Connecter Stripe » ; Revold validera la clé auprès de Stripe avant de l'activer.",
      className: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }
  if (key.length < 20) {
    return {
      severity: "warning",
      title: "La clé semble incomplète.",
      body: "Les clés Stripe font plus de 30 caractères. Vérifiez le collage.",
      className: "border border-amber-200 bg-amber-50 text-amber-800",
    };
  }
  return {
    severity: "error",
    title: "❌ Format non reconnu.",
    body: "Une clé Stripe valide commence par sk_live_, sk_test_, rk_live_ ou rk_test_.",
    className: "border border-red-200 bg-red-50 text-red-700",
  };
}
