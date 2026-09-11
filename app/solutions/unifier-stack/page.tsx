import { SolutionPage } from "@/components/solution-page";
import { ShotDashboard } from "@/components/site/product-shots";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unifier sa stack revenue",
  description: "CRM, facturation, banque et support reliés par identifiants légaux français : une seule vision fiable de vos revenus, sans code ni exports manuels.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function UnifierStackPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Unifiez votre stack"
      titleAccent="sans tout changer."
      subtitle="68% des organisations citent les silos de données comme obstacle #1. Revold se pose au-dessus de vos outils existants — HubSpot, Stripe, Pennylane, Chargebee, GoCardless, Sage — et les fait parler entre eux."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
      shot={<ShotDashboard />}
      keyBenefits={[
        { title: "Connecteurs natifs, câblés en profondeur", desc: "HubSpot (OAuth), Stripe, Pennylane, Chargebee, GoCardless, Sage + import Excel / Google Sheets. Sans code, sans scripts custom, en lecture seule révocable." },
        { title: "Rapprochement par identifiants légaux", desc: "Identifiants légaux : la même entreprise est reconnue partout, et les identifiants manquants sont remplis via la base Sirene officielle." },
        { title: "Modèle de données unifié", desc: "Toutes les sources sont normalisées dans un schéma commun. Une seule source de vérité, vérifiable chiffre par chiffre." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Chaque équipe a ses outils, ses dashboards, ses chiffres. Pas d'alignement.", solution: "Une plateforme au-dessus de tous les outils avec une vue unifiée et des espaces par équipe.", result: "Alignement de toute l'organisation sur les mêmes données." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Maintenance d'intégrations custom fragiles. Chaque changement d'outil casse tout.", solution: "Connecteurs natifs maintenus par Revold + audit d'onboarding par outil connecté.", result: "Stack flexible. Ajoutez un outil en minutes, sans plomberie custom." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Les données financières (Stripe, Pennylane, Sage) ne sont pas connectées au CRM.", solution: "Factures, abonnements et écritures synchronisés et croisés avec le pipeline.", result: "Réconciliation automatique. Vision financière alignée avec le commercial." },
      ]}
      relatedProducts={[
        { label: "Synchronisation de données", href: "/produits/synchronisation" },
        { label: "Résolution d'entités", href: "/produits/resolution-entites" },
        { label: "Tableaux de bord & templates", href: "/produits/tableaux-de-bord" },
      ]}
    />
  );
}
