import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conformité RGPD — Revold",
  description: "Engagements de Revold en matière de conformité RGPD : responsable de traitement, bases légales, droits des personnes, sous-traitants.",
};

export default function RGPDPage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Dernière mise à jour : 14 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Conformité RGPD</h1>
      <p className="mt-6 text-slate-600">Revold s&apos;engage à respecter le Règlement Général sur la Protection des Données (UE) 2016/679. Cette page détaille nos engagements et pratiques.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Responsable de traitement</h2>
      <p className="mt-3 text-slate-600">Le responsable de traitement est Air Rise Inc., société éditrice de Revold.</p>
      <p className="mt-2 text-slate-600">Contact DPO : <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline">dpo@revold.io</a></p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Bases légales du traitement</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-card-border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-card-border bg-slate-50"><th className="px-4 py-3 text-left font-medium text-slate-500">Traitement</th><th className="px-4 py-3 text-left font-medium text-slate-500">Base légale</th></tr></thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-card-border"><td className="px-4 py-3">Fourniture du service</td><td className="px-4 py-3">Exécution du contrat (Art. 6.1.b)</td></tr>
            <tr className="border-b border-card-border"><td className="px-4 py-3">Amélioration du service</td><td className="px-4 py-3">Intérêt légitime (Art. 6.1.f)</td></tr>
            <tr className="border-b border-card-border"><td className="px-4 py-3">Communications marketing</td><td className="px-4 py-3">Consentement (Art. 6.1.a)</td></tr>
            <tr><td className="px-4 py-3">Obligations légales</td><td className="px-4 py-3">Obligation légale (Art. 6.1.c)</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Droits des personnes concernées</h2>
      <p className="mt-3 text-slate-600">Conformément aux articles 15 à 22 du RGPD, vous disposez des droits suivants :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Droit d&apos;accès</strong> (Art. 15) : obtenir une copie de vos données personnelles.</li>
        <li><strong>Droit de rectification</strong> (Art. 16) : corriger des données inexactes.</li>
        <li><strong>Droit à l&apos;effacement</strong> (Art. 17) : demander la suppression de vos données.</li>
        <li><strong>Droit à la limitation</strong> (Art. 18) : restreindre le traitement de vos données.</li>
        <li><strong>Droit à la portabilité</strong> (Art. 20) : recevoir vos données dans un format structuré.</li>
        <li><strong>Droit d&apos;opposition</strong> (Art. 21) : vous opposer au traitement.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Sous-traitants</h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-card-border bg-white">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-card-border bg-slate-50"><th className="px-4 py-3 text-left font-medium text-slate-500">Sous-traitant</th><th className="px-4 py-3 text-left font-medium text-slate-500">Finalité</th><th className="px-4 py-3 text-left font-medium text-slate-500">Localisation</th></tr></thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-card-border"><td className="px-4 py-3">Vercel</td><td className="px-4 py-3">Hébergement</td><td className="px-4 py-3">USA (DPF)</td></tr>
            <tr className="border-b border-card-border"><td className="px-4 py-3">Supabase</td><td className="px-4 py-3">Base de données</td><td className="px-4 py-3">USA (DPF)</td></tr>
            <tr className="border-b border-card-border"><td className="px-4 py-3">Anthropic</td><td className="px-4 py-3">IA (génération d&apos;insights)</td><td className="px-4 py-3">USA (DPF)</td></tr>
            <tr><td className="px-4 py-3">Stripe</td><td className="px-4 py-3">Paiements</td><td className="px-4 py-3">USA (DPF + SCC)</td></tr>
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Transferts internationaux</h2>
      <p className="mt-3 text-slate-600">Les transferts vers les USA sont encadrés par le Data Privacy Framework (DPF) et, le cas échéant, par des Clauses Contractuelles Types (SCC) approuvées par la Commission européenne.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Durées de conservation</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Données de compte</strong> : durée de l&apos;abonnement + 30 jours.</li>
        <li><strong>Données CRM synchronisées</strong> : durée de l&apos;abonnement + 30 jours.</li>
        <li><strong>Logs de sync</strong> : 12 mois glissants.</li>
        <li><strong>Données de facturation</strong> : 10 ans (obligation légale comptable).</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Exercer vos droits</h2>
      <p className="mt-3 text-slate-600">Envoyez votre demande à <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline">dpo@revold.io</a> en précisant votre identité et la nature de votre demande. Nous répondrons sous 30 jours.</p>
      <p className="mt-3 text-slate-600">Vous pouvez également introduire une réclamation auprès de la CNIL : <a href="https://www.cnil.fr" className="font-medium text-accent hover:underline" target="_blank" rel="noopener noreferrer">www.cnil.fr</a></p>
    </article>
  );
}
