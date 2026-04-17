import { SolutionPage } from "@/components/solution-page";

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function UnifierStackPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Unifiez votre stack"
      titleAccent="sans tout changer."
      subtitle="68% des organisations citent les silos de données comme obstacle #1. Revold se pose au-dessus de vos outils existants et les fait parler entre eux."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
      screenshot="/screenshots/dashboard-overview.png"
      keyBenefits={[
        { title: "Connecteurs natifs", desc: "CRM, facturation, support — tous connectés sans code, sans scripts custom, sans maintenance." },
        { title: "CRM-agnostic", desc: "Fonctionne avec HubSpot, Salesforce, Pipedrive, Zoho. Changez de CRM, gardez Revold." },
        { title: "Modèle de données unifié", desc: "Toutes les sources sont normalisées dans un schéma unifié. Une seule source de vérité." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Chaque équipe a ses outils, ses dashboards, ses chiffres. Pas d'alignement.", solution: "Une plateforme au-dessus de tous les outils avec une vue unifiée.", result: "Alignement de toute l'organisation sur les mêmes données." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "HubSpot Marketing ne voit pas les données Stripe ou Zendesk.", solution: "Les données billing et support sont accessibles dans les rapports marketing.", result: "Attribution end-to-end : campagne → lead → deal → facture → rétention." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "Le CRM ne montre pas les factures ni les tickets du client.", solution: "Fiche client enrichie : deal + historique de paiement + tickets support.", result: "Contexte complet pour chaque conversation commerciale." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Maintenance de 5+ intégrations custom. Chaque changement d'outil casse tout.", solution: "Connecteurs standardisés avec interface SourceConnector. Ajout d'un outil en minutes.", result: "Stack flexible. Changez d'outil sans perdre votre intelligence revenus." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Pas de vue unifiée du client entre CRM, billing et support.", solution: "Entity resolution cross-source : un client = une fiche, toutes les sources.", result: "Onboarding, suivi et renouvellement avec contexte complet." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Les données financières (Stripe, Pennylane) ne sont pas connectées au CRM.", solution: "Factures, abonnements et paiements synchronisés et croisés avec le pipeline.", result: "Réconciliation automatique. Vision financière alignée avec le commercial." },
      ]}
      relatedProducts={[
        { label: "Synchronisation de données", href: "/produits/synchronisation" },
        { label: "Résolution d'entités", href: "/produits/resolution-entites" },
        { label: "Audit complet du CRM", href: "/produits/audit-crm" },
      ]}
    />
  );
}
