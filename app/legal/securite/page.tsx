import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sécurité — Revold",
  description: "Pratiques de sécurité de Revold : infrastructure, chiffrement, authentification, isolation des données et conformité.",
};

export default function SecuritePage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Dernière mise à jour : 14 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Sécurité</h1>
      <p className="mt-6 text-slate-600">La sécurité de vos données est au coeur de Revold. Voici nos pratiques et engagements en matière de sécurité.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Infrastructure</h2>
      <p className="mt-3 text-slate-600">Revold est hébergé sur <strong>Vercel</strong> (edge network mondial) et utilise <strong>Supabase</strong> (PostgreSQL managé sur AWS). Les deux fournisseurs sont certifiés SOC 2 Type II.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Chiffrement</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>En transit</strong> : toutes les communications sont chiffrées via TLS 1.3.</li>
        <li><strong>Au repos</strong> : les données sont chiffrées avec AES-256 au niveau de la base de données.</li>
        <li><strong>Tokens OAuth</strong> : les tokens d&apos;intégration sont stockés chiffrés dans Supabase avec accès restreint par RLS.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Authentification</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Supabase Auth</strong> : authentification email/password avec magic link disponible.</li>
        <li><strong>Sessions sécurisées</strong> : tokens JWT avec refresh automatique via middleware edge.</li>
        <li><strong>OAuth2</strong> : les intégrations tierces utilisent OAuth2 avec refresh token rotation.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Isolation des données (Multi-tenant)</h2>
      <p className="mt-3 text-slate-600">Chaque organisation a ses données isolées au niveau de la base de données via <strong>Row Level Security (RLS)</strong> de PostgreSQL. Chaque table contient un <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">organization_id</code> et les policies RLS garantissent qu&apos;un utilisateur ne peut accéder qu&apos;aux données de son organisation.</p>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Monitoring et détection</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Logs de synchronisation horodatés pour chaque opération.</li>
        <li>Alertes automatiques en cas d&apos;erreur de sync ou d&apos;anomalie.</li>
        <li>Monitoring d&apos;uptime et de performance via Vercel Analytics.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Réponse aux incidents</h2>
      <p className="mt-3 text-slate-600">En cas d&apos;incident de sécurité, nous nous engageons à :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Identifier et contenir l&apos;incident dans les plus brefs délais.</li>
        <li>Notifier les utilisateurs affectés sous 72 heures (conformément au RGPD).</li>
        <li>Publier un post-mortem transparent.</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Conformité</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>RGPD : conformité totale (voir notre <a href="/legal/rgpd" className="font-medium text-accent hover:underline">page RGPD</a>).</li>
        <li>Sous-traitants certifiés SOC 2 Type II (Vercel, Supabase, Stripe).</li>
        <li>Aucune donnée de carte bancaire stockée (gérée par Stripe PCI DSS Level 1).</li>
      </ul>

      <h2 className="mt-10 text-xl font-bold text-slate-900">Contact sécurité</h2>
      <p className="mt-3 text-slate-600">Pour signaler une vulnérabilité ou poser une question : <a href="mailto:security@revold.io" className="font-medium text-accent hover:underline">security@revold.io</a></p>
    </article>
  );
}
