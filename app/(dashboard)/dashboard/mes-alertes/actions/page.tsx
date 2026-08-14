export const dynamic = "force-dynamic";

import { ActionsInbox } from "@/components/actions/actions-inbox";

/**
 * Suivi → Actions : la boîte de réception des actions à exécuter dans les
 * outils (tâches HubSpot, rappels Stripe…), proposées par les détecteurs
 * Revold et les agents — validées ou refusées par l'utilisateur, exécution
 * réelle tracée.
 */
export default function ActionsPage() {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Actions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Revold détecte, tu valides, l&apos;action s&apos;exécute directement dans tes outils — deals silencieux à
          relancer, impayés à rappeler. Rien ne part sans ta validation.
        </p>
      </header>
      <ActionsInbox />
    </section>
  );
}
