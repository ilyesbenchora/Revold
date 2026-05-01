import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sécurité & Conformité — Revold",
  description: "Pratiques de sécurité de Revold : hébergement EU (Frankfurt), chiffrement, sous-processeurs, RGPD, DPA, plan de continuité et roadmap SOC 2.",
};

const subProcessors = [
  { name: "Vercel", purpose: "Hébergement applicatif (Next.js)", region: "Frankfurt (fra1) — Allemagne", certifs: "SOC 2 Type II, ISO 27001, GDPR DPA" },
  { name: "Supabase", purpose: "Base de données PostgreSQL + Auth", region: "Frankfurt (eu-central-1, AWS) — Allemagne", certifs: "SOC 2 Type II, HIPAA, GDPR DPA" },
  { name: "Anthropic", purpose: "Génération d'insights IA (Claude)", region: "EU (Ireland) — pas de training sur les données", certifs: "SOC 2 Type II, GDPR DPA, zero data retention" },
  { name: "Stripe", purpose: "Paiements & abonnements (futur)", region: "EU (Irlande) — données carte hors Revold", certifs: "PCI DSS Level 1, SOC 1/2, GDPR DPA" },
  { name: "Resend", purpose: "Envoi d'emails transactionnels", region: "EU (Frankfurt)", certifs: "SOC 2 Type II, GDPR DPA" },
];

export default function SecuritePage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Dernière mise à jour : 30 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Sécurité & Conformité</h1>
      <p className="mt-6 text-slate-600">
        Revold traite des données CRM sensibles (contacts B2B, deals, factures). Nous appliquons une politique de
        sécurité <strong>defense-in-depth</strong> et hébergeons l&apos;intégralité des données de production
        <strong> en Union européenne</strong>. Cette page documente précisément nos pratiques pour que vos équipes
        sécurité et juridique disposent de tous les éléments avant de signer.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Hébergement</p>
          <p className="mt-1 text-base font-bold text-slate-900">100 % UE</p>
          <p className="mt-1 text-[11px] text-slate-600">Frankfurt — Vercel + Supabase</p>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Chiffrement</p>
          <p className="mt-1 text-base font-bold text-slate-900">TLS 1.3 + AES-256</p>
          <p className="mt-1 text-[11px] text-slate-600">En transit + au repos</p>
        </div>
        <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">Conformité</p>
          <p className="mt-1 text-base font-bold text-slate-900">RGPD · DPA · SOC 2</p>
          <p className="mt-1 text-[11px] text-slate-600">SOC 2 Type 1 visé Q4 2026</p>
        </div>
      </div>

      <h2 id="hebergement" className="mt-10 text-xl font-bold text-slate-900">Hébergement & localisation des données</h2>
      <p className="mt-3 text-slate-600">
        L&apos;intégralité des données client (production et sauvegardes) est hébergée dans des datacenters situés en
        <strong> Allemagne (Frankfurt) au sein de l&apos;Union européenne</strong>. Aucune donnée client n&apos;est
        transférée hors UE dans le cadre du fonctionnement nominal du service.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Application</strong> : Vercel — région <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">fra1</code> (Frankfurt, Allemagne).</li>
        <li><strong>Base de données + Auth</strong> : Supabase — projet <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">eu-central-1</code> (Frankfurt, AWS).</li>
        <li><strong>Sauvegardes</strong> : snapshots Supabase quotidiens, conservés 7 jours, dans la même région UE.</li>
        <li><strong>Logs</strong> : Vercel + Supabase, conservation 30 jours, anonymisés au-delà.</li>
      </ul>

      <h2 id="chiffrement" className="mt-10 text-xl font-bold text-slate-900">Chiffrement</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>En transit</strong> : TLS 1.3 obligatoire sur toutes les communications (HTTPS strict, HSTS activé).</li>
        <li><strong>Au repos</strong> : AES-256 sur le stockage Supabase + EBS chiffrés AWS KMS.</li>
        <li><strong>Tokens d&apos;intégration</strong> : access_token et refresh_token OAuth (HubSpot, Stripe, Pennylane…) stockés en base avec accès restreint par RLS, jamais loggés.</li>
        <li><strong>Secrets applicatifs</strong> : variables d&apos;environnement Vercel chiffrées, accessibles uniquement au runtime.</li>
      </ul>

      <h2 id="auth" className="mt-10 text-xl font-bold text-slate-900">Authentification & contrôle d&apos;accès</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Supabase Auth</strong> : email/password + magic link, hashing bcrypt, JWT signés.</li>
        <li><strong>Sessions</strong> : refresh automatique via middleware edge, expiration configurable.</li>
        <li><strong>OAuth2 tiers</strong> : refresh token rotation pour HubSpot ; révocation côté Revold = révocation effective de l&apos;accès au CRM.</li>
        <li><strong>RBAC (en cours)</strong> : 3 rôles (admin / manager / rep) + audit log d&apos;actions sensibles.</li>
        <li><strong>SSO / SAML</strong> : sur la roadmap Enterprise (V2.7).</li>
      </ul>

      <h2 id="isolation" className="mt-10 text-xl font-bold text-slate-900">Isolation multi-tenant</h2>
      <p className="mt-3 text-slate-600">
        Chaque organisation cliente dispose de ses propres données strictement isolées au niveau base via
        <strong> Row Level Security (RLS)</strong> PostgreSQL. Toutes les tables exposant des données client portent
        une colonne <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">organization_id</code> contrôlée par
        des policies RLS qui s&apos;exécutent dans la base elle-même : un utilisateur authentifié ne peut techniquement
        pas accéder aux données d&apos;une autre organisation, même via une requête SQL forgée.
      </p>

      <h2 id="sous-processeurs" className="mt-10 text-xl font-bold text-slate-900">Sous-processeurs</h2>
      <p className="mt-3 text-slate-600">
        Liste exhaustive des sous-processeurs qui interviennent dans le traitement de données pour le compte de
        Revold, avec leur région et leurs certifications. Cette liste est mise à jour avant tout ajout, avec préavis
        de 30 jours pour les clients sous DPA.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50">
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Sous-processeur</th>
              <th className="px-4 py-3">Finalité</th>
              <th className="px-4 py-3">Région</th>
              <th className="px-4 py-3">Certifications</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subProcessors.map((sp) => (
              <tr key={sp.name}>
                <td className="px-4 py-3 font-semibold text-slate-900">{sp.name}</td>
                <td className="px-4 py-3 text-slate-600">{sp.purpose}</td>
                <td className="px-4 py-3 text-slate-600">{sp.region}</td>
                <td className="px-4 py-3 text-slate-600">{sp.certifs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="continuite" className="mt-10 text-xl font-bold text-slate-900">Continuité d&apos;activité & sauvegardes</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Sauvegardes</strong> : snapshots quotidiens automatiques de la base Supabase, rétention 7 jours, restauration testée trimestriellement.</li>
        <li><strong>RPO</strong> (Recovery Point Objective) : ≤ 24 h.</li>
        <li><strong>RTO</strong> (Recovery Time Objective) : ≤ 4 h pour la base, ≤ 30 min pour l&apos;application.</li>
        <li><strong>Multi-AZ</strong> : Supabase eu-central-1 sur AWS, redondance entre zones de disponibilité.</li>
      </ul>

      <h2 id="monitoring" className="mt-10 text-xl font-bold text-slate-900">Monitoring & journalisation</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Logs applicatifs</strong> : Vercel runtime logs, conservation 30 jours, accès restreint à 2 personnes.</li>
        <li><strong>Logs de sync</strong> : table <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">sync_logs</code> par organisation, accessibles depuis Paramètres → Intégrations.</li>
        <li><strong>Audit log</strong> (en cours) : actions sensibles (connexion, changement de rôle, export, suppression) tracées avec horodatage et acteur.</li>
        <li><strong>Détection d&apos;anomalies</strong> : alertes automatiques sur erreurs 5xx, échecs de sync répétés, connexions suspectes.</li>
      </ul>

      <h2 id="incident" className="mt-10 text-xl font-bold text-slate-900">Réponse aux incidents</h2>
      <p className="mt-3 text-slate-600">
        En cas d&apos;incident de sécurité avéré :
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Confinement et investigation immédiate.</li>
        <li><strong>Notification aux clients affectés sous 72 h</strong> conformément à l&apos;article 33 RGPD.</li>
        <li>Notification à la CNIL le cas échéant.</li>
        <li>Post-mortem public avec timeline, cause racine et mesures correctives.</li>
      </ul>

      <h2 id="audit" className="mt-10 text-xl font-bold text-slate-900">Tests d&apos;intrusion & divulgation responsable</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Pen test annuel</strong> par un cabinet externe indépendant (premier audit prévu Q3 2026).</li>
        <li><strong>Programme de divulgation responsable</strong> : envoyez vos rapports à <a href="mailto:security@revold.io" className="font-medium text-accent hover:underline">security@revold.io</a>. Nous accusons réception sous 48 h ouvrées et nous nous engageons à ne pas poursuivre les chercheurs agissant de bonne foi.</li>
        <li><strong>SCA + Dependabot</strong> : revue automatique des dépendances open-source, patches CVE appliqués sous 7 jours pour les sévérités critiques.</li>
      </ul>

      <h2 id="conformite" className="mt-10 text-xl font-bold text-slate-900">Conformité & engagements contractuels</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>RGPD</strong> : Revold est responsable conjoint avec ses clients pour les données traitées (voir <Link href="/legal/rgpd" className="font-medium text-accent hover:underline">page RGPD</Link>).</li>
        <li><strong>DPA</strong> (Data Processing Agreement) : signature électronique disponible à la demande pour tout client B2B, intégré aux conditions générales (voir <Link href="/legal/dpa" className="font-medium text-accent hover:underline">notre DPA</Link>).</li>
        <li><strong>SOC 2 Type 1</strong> : audit visé Q4 2026.</li>
        <li><strong>SOC 2 Type 2</strong> : période d&apos;observation de 12 mois après Type 1, donc finalisation visée Q4 2027.</li>
        <li><strong>HDS</strong> (santé) : non applicable, Revold ne traite pas de données de santé.</li>
      </ul>

      <h2 id="contact" className="mt-10 text-xl font-bold text-slate-900">Contact sécurité</h2>
      <p className="mt-3 text-slate-600">
        DPO et équipe sécurité : <a href="mailto:security@revold.io" className="font-medium text-accent hover:underline">security@revold.io</a>.<br />
        Pour les demandes RGPD (accès, rectification, suppression) : <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline">dpo@revold.io</a>.
      </p>

      <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">Documents complémentaires</p>
        <ul className="mt-3 space-y-1 text-sm">
          <li><Link href="/legal/dpa" className="font-medium text-accent hover:underline">→ Data Processing Agreement (DPA)</Link></li>
          <li><Link href="/legal/rgpd" className="font-medium text-accent hover:underline">→ Politique RGPD</Link></li>
          <li><Link href="/legal/confidentialite" className="font-medium text-accent hover:underline">→ Politique de confidentialité</Link></li>
          <li><Link href="/legal/cgu" className="font-medium text-accent hover:underline">→ Conditions générales d&apos;utilisation</Link></li>
        </ul>
      </div>
    </article>
  );
}
