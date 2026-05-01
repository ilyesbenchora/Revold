import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Data Processing Agreement (DPA) — Revold",
  description: "Accord de traitement des données de Revold conforme au RGPD. Définit les rôles, les obligations et les engagements de Revold en tant que sous-traitant.",
};

export default function DpaPage() {
  return (
    <article className="prose-revold">
      <p className="text-sm text-slate-400">Version 1.0 — En vigueur au 30 avril 2026</p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">Data Processing Agreement (DPA)</h1>
      <p className="mt-6 text-slate-600">
        Le présent Accord de Traitement des Données (« <strong>DPA</strong> ») complète les Conditions Générales
        d&apos;Utilisation (« <strong>CGU</strong> ») entre <strong>Revold SAS</strong> (« <em>Revold</em> », le
        « <em>Sous-traitant</em> ») et le client (« <em>Responsable de traitement</em> »). Il s&apos;applique dès
        que le client active son compte Revold.
      </p>
      <p className="mt-3 text-slate-600">
        Ce DPA est conforme au <strong>Règlement (UE) 2016/679 (RGPD)</strong> et aux clauses contractuelles types
        adoptées par la Commission européenne (décision 2021/914 du 4 juin 2021).
      </p>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">⚠ Signature électronique</p>
        <p className="mt-1 text-xs text-amber-800">
          Pour une version contre-signée par Revold avec en-tête à votre nom et signature électronique qualifiée,
          envoyez votre demande à <a href="mailto:dpo@revold.io" className="font-medium underline">dpo@revold.io</a>.
          La version ci-dessous est juridiquement opposable dès l&apos;activation du compte.
        </p>
      </div>

      <h2 id="article-1" className="mt-10 text-xl font-bold text-slate-900">1. Définitions</h2>
      <p className="mt-3 text-sm text-slate-600">
        Les termes <em>Données à caractère personnel</em>, <em>Traitement</em>, <em>Responsable du traitement</em>,
        <em> Sous-traitant</em>, <em>Personne concernée</em>, <em>Violation de données</em> et <em>Autorité de
        contrôle</em> ont la signification définie à l&apos;article 4 du RGPD.
      </p>

      <h2 id="article-2" className="mt-10 text-xl font-bold text-slate-900">2. Objet et nature du traitement</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>Finalités</strong> : agrégation et analyse de données CRM, billing et support pour produire des indicateurs de revenue intelligence et des recommandations IA à destination du Responsable de traitement.</li>
        <li><strong>Catégories de données</strong> : identifiants (nom, email, téléphone), données professionnelles (entreprise, fonction, pays), interactions commerciales (deals, montants, dates), données de facturation (factures, abonnements, montants).</li>
        <li><strong>Catégories de personnes concernées</strong> : prospects, clients et fournisseurs du Responsable de traitement, ses utilisateurs internes (équipes Sales, Marketing, RevOps).</li>
        <li><strong>Durée du traitement</strong> : durée du contrat + 30 jours de conservation pour permettre l&apos;export, puis suppression définitive.</li>
      </ul>

      <h2 id="article-3" className="mt-10 text-xl font-bold text-slate-900">3. Obligations du Sous-traitant</h2>
      <p className="mt-3 text-sm text-slate-600">Revold s&apos;engage à :</p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Traiter les Données uniquement sur instruction documentée du Responsable de traitement (configuration du compte, paramétrage des connecteurs).</li>
        <li>Garantir que les personnes autorisées à traiter les Données sont soumises à une obligation de confidentialité.</li>
        <li>Mettre en œuvre les mesures techniques et organisationnelles appropriées (article 32 RGPD) — voir <Link href="/legal/securite" className="font-medium text-accent hover:underline">page Sécurité</Link> pour le détail.</li>
        <li>Assister le Responsable de traitement dans la réponse aux demandes des personnes concernées (accès, rectification, effacement, portabilité, opposition).</li>
        <li>Notifier le Responsable de traitement de toute violation de données dans un délai maximal de <strong>72 heures</strong>.</li>
        <li>Supprimer ou restituer les Données à la fin du contrat, à la discrétion du Responsable de traitement.</li>
      </ul>

      <h2 id="article-4" className="mt-10 text-xl font-bold text-slate-900">4. Localisation des données et transferts hors UE</h2>
      <p className="mt-3 text-sm text-slate-600">
        Les Données sont hébergées <strong>exclusivement en Union européenne</strong>, dans des datacenters situés à
        Frankfurt (Allemagne) opérés par Vercel et Supabase (AWS eu-central-1). Aucun transfert vers un pays tiers
        n&apos;est nécessaire au fonctionnement du Service.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Les sous-processeurs Anthropic (génération d&apos;insights IA) et Stripe (paiements futurs) traitent
        certaines données à partir d&apos;infrastructures en Irlande (UE). Le détail figure dans la
        <Link href="/legal/securite#sous-processeurs" className="font-medium text-accent hover:underline"> section Sous-processeurs</Link>.
      </p>

      <h2 id="article-5" className="mt-10 text-xl font-bold text-slate-900">5. Sous-processeurs ultérieurs</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Le Responsable de traitement autorise par avance Revold à recourir aux sous-processeurs listés sur la <Link href="/legal/securite#sous-processeurs" className="font-medium text-accent hover:underline">page Sécurité</Link>.</li>
        <li>Avant toute modification de cette liste, Revold informe le Responsable de traitement <strong>au moins 30 jours à l&apos;avance</strong> par email.</li>
        <li>Le Responsable de traitement peut s&apos;opposer à un sous-processeur dans ce délai. À défaut d&apos;accord, le contrat peut être résilié sans pénalité.</li>
        <li>Revold contractualise avec ses sous-processeurs des obligations équivalentes à celles du présent DPA.</li>
      </ul>

      <h2 id="article-6" className="mt-10 text-xl font-bold text-slate-900">6. Sécurité du traitement</h2>
      <p className="mt-3 text-sm text-slate-600">
        Revold met en œuvre les mesures suivantes (liste non exhaustive, voir <Link href="/legal/securite" className="font-medium text-accent hover:underline">page Sécurité</Link>) :
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>Chiffrement TLS 1.3 en transit et AES-256 au repos.</li>
        <li>Isolation logique multi-tenant via Row Level Security PostgreSQL.</li>
        <li>Authentification forte (Supabase Auth, JWT signés, refresh rotation).</li>
        <li>Sauvegardes quotidiennes chiffrées avec rétention 7 jours.</li>
        <li>Tests de pénétration annuels par un cabinet externe indépendant.</li>
        <li>Programme de divulgation responsable (security@revold.io).</li>
      </ul>

      <h2 id="article-7" className="mt-10 text-xl font-bold text-slate-900">7. Audits</h2>
      <p className="mt-3 text-sm text-slate-600">
        Le Responsable de traitement peut, sous préavis raisonnable (30 jours minimum) et à ses frais, faire réaliser
        un audit de la conformité de Revold au présent DPA, soit directement, soit via un auditeur externe non
        concurrent. Revold met à disposition gratuitement les rapports d&apos;audit SOC 2 (lorsque disponibles, visés
        Q4 2026 pour Type 1) qui se substituent à un audit direct dans la majorité des cas.
      </p>

      <h2 id="article-8" className="mt-10 text-xl font-bold text-slate-900">8. Notification de violation de données</h2>
      <p className="mt-3 text-sm text-slate-600">
        En cas de violation de Données affectant le Responsable de traitement, Revold notifie celui-ci dans un délai
        <strong> maximal de 72 heures</strong> après en avoir pris connaissance. La notification inclut :
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li>La nature de la violation et les catégories de Données concernées.</li>
        <li>Le nombre approximatif de personnes concernées et d&apos;enregistrements impactés.</li>
        <li>Les conséquences probables.</li>
        <li>Les mesures prises ou proposées pour remédier à la violation et atténuer ses effets.</li>
        <li>Le contact du DPO pour obtenir des informations complémentaires.</li>
      </ul>

      <h2 id="article-9" className="mt-10 text-xl font-bold text-slate-900">9. Droits des personnes concernées</h2>
      <p className="mt-3 text-sm text-slate-600">
        Revold assiste le Responsable de traitement dans la réponse aux demandes d&apos;exercice des droits prévus
        aux articles 12 à 22 du RGPD (information, accès, rectification, effacement, limitation, portabilité,
        opposition, profilage). Les requêtes peuvent être adressées à
        <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline"> dpo@revold.io</a>.
        Revold s&apos;engage à un délai de réponse <strong>≤ 7 jours ouvrés</strong>.
      </p>

      <h2 id="article-10" className="mt-10 text-xl font-bold text-slate-900">10. Suppression des données</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-sm text-slate-600">
        <li><strong>À la fin du contrat</strong> : sur demande, Revold restitue les Données dans un format structuré (CSV / JSON) sous 30 jours, puis procède à leur suppression définitive de toutes les bases (production + sauvegardes) sous 60 jours supplémentaires.</li>
        <li><strong>Suppression à la demande</strong> : possibilité d&apos;effacer un compte client ou un contact spécifique à tout moment depuis l&apos;UI ou par email à <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline">dpo@revold.io</a>.</li>
        <li><strong>Logs anonymisés</strong> : les logs techniques sont anonymisés après 30 jours pour préserver la traçabilité opérationnelle sans identification directe.</li>
      </ul>

      <h2 id="article-11" className="mt-10 text-xl font-bold text-slate-900">11. Responsabilité et limitations</h2>
      <p className="mt-3 text-sm text-slate-600">
        La responsabilité de Revold au titre du présent DPA est limitée dans les conditions définies par les CGU.
        Aucune limitation ne s&apos;applique aux dommages résultant d&apos;un manquement délibéré ou d&apos;une faute
        lourde de Revold, ni aux obligations légales d&apos;ordre public.
      </p>

      <h2 id="article-12" className="mt-10 text-xl font-bold text-slate-900">12. Droit applicable et juridiction</h2>
      <p className="mt-3 text-sm text-slate-600">
        Le présent DPA est régi par le droit français. Tout litige sera soumis aux tribunaux compétents du ressort de
        Paris, sauf disposition impérative contraire.
      </p>

      <h2 id="contact" className="mt-10 text-xl font-bold text-slate-900">Contact</h2>
      <p className="mt-3 text-sm text-slate-600">
        Délégué à la protection des données (DPO) : <a href="mailto:dpo@revold.io" className="font-medium text-accent hover:underline">dpo@revold.io</a>
        <br />Pour toute question sur ce DPA ou pour demander une version contre-signée : même adresse.
      </p>

      <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">Documents complémentaires</p>
        <ul className="mt-3 space-y-1 text-sm">
          <li><Link href="/legal/securite" className="font-medium text-accent hover:underline">→ Page Sécurité (mesures techniques détaillées)</Link></li>
          <li><Link href="/legal/rgpd" className="font-medium text-accent hover:underline">→ Politique RGPD</Link></li>
          <li><Link href="/legal/confidentialite" className="font-medium text-accent hover:underline">→ Politique de confidentialité</Link></li>
          <li><Link href="/legal/cgu" className="font-medium text-accent hover:underline">→ Conditions générales d&apos;utilisation</Link></li>
        </ul>
      </div>
    </article>
  );
}
