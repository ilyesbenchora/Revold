export const dynamic = "force-dynamic";

import { ParametresTabs } from "@/components/parametres-tabs";
import { getAuthUser } from "@/lib/supabase/cached";

export default async function ParametresSecuriteApiPage() {
  const user = await getAuthUser();
  if (!user) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gestion de la sécurité du compte, accès API et webhooks pour intégrer Revold à votre stack.
        </p>
      </header>

      <ParametresTabs />

      {/* Authentification */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Authentification
        </h2>
        <div className="card p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">Email du compte</p>
                <p className="mt-0.5 text-xs text-slate-500">{user.email}</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                ✓ Vérifié
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Mot de passe</p>
                <p className="mt-0.5 text-xs text-slate-500">Dernière modification : —</p>
              </div>
              <button disabled className="rounded-lg border border-card-border bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400">
                Modifier
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Authentification à 2 facteurs</p>
                <p className="mt-0.5 text-xs text-slate-500">Sécurise votre compte avec un code généré sur votre téléphone</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Bientôt disponible
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">SSO (Single Sign-On)</p>
                <p className="mt-0.5 text-xs text-slate-500">Authentification SAML/Google Workspace pour les équipes Enterprise</p>
              </div>
              <span className="rounded-full bg-fuchsia-50 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700">
                Plan Enterprise
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Clés d&apos;API Revold
        </h2>
        <p className="text-sm text-slate-500">
          Générez des clés API pour interagir avec Revold depuis vos outils internes (workflows, scripts, BI).
        </p>
        <div className="card p-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">Aucune clé d&apos;API générée</p>
            <p className="mt-1 text-xs text-slate-500">
              Les clés d&apos;API permettent de lire vos données Revold depuis vos propres outils.
            </p>
            <button disabled className="mt-3 inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-slate-400">
              Générer une nouvelle clé
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-600">
            <p className="text-[10px] font-semibold uppercase text-slate-500">Endpoint de base</p>
            <p className="mt-1">https://app.revold.com/api/v1</p>
          </div>
        </div>
      </div>

      {/* Webhooks sortants */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Webhooks sortants
        </h2>
        <p className="text-sm text-slate-500">
          Recevez en temps réel les événements Revold (nouvelle alerte, rapport activé, score modifié) sur vos endpoints.
        </p>
        <div className="card p-6">
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-medium text-slate-700">Aucun webhook configuré</p>
            <p className="mt-1 text-xs text-slate-500">
              Configurez une URL HTTPS qui recevra les événements Revold en POST JSON.
            </p>
            <button disabled className="mt-3 inline-flex items-center gap-2 rounded-lg border border-card-border bg-white px-4 py-2 text-sm font-medium text-slate-400">
              Ajouter un webhook
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">alert.created</div>
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">insight.generated</div>
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">score.changed</div>
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">sync.completed</div>
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">deal.at_risk</div>
            <div className="rounded bg-slate-50 px-2 py-1.5 font-mono text-slate-600">churn.predicted</div>
          </div>
        </div>
      </div>

      {/* Sessions actives */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Sessions actives
        </h2>
        <div className="card overflow-hidden">
          <div className="divide-y divide-card-border">
            <div className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Session courante</p>
                <p className="text-xs text-slate-400">{user.email} · Dernière activité : à l&apos;instant</p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Actif</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Pour vous déconnecter, utilisez le bouton « Déconnexion » dans le header.
        </p>
      </div>

      {/* Audit log */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-slate-400" />Journal d&apos;audit
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700">Plan Enterprise</span>
        </h2>
        <div className="card p-6 text-center">
          <p className="text-sm text-slate-500">
            Le journal d&apos;audit complet (qui a fait quoi, quand) est disponible sur le plan Enterprise.
          </p>
        </div>
      </div>
    </section>
  );
}
