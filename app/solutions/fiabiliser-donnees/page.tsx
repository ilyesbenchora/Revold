import { SolutionPage } from "@/components/solution-page";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fiabiliser ses données CRM",
  description: "Audit automatique, déduplication par SIREN et enrichissement Sirene/INPI : une base CRM propre, complète et rapprochée de la facturation.",
};

const teamIcon = (d: string) => <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;

export default function FiabiliserDonneesPage() {
  return (
    <SolutionPage
      badge="Solution"
      title="Fiabilisez vos données"
      titleAccent="une bonne fois pour toutes."
      subtitle="76% des orgas ont moins de 50% de données CRM fiables. Revold audite vos données, les rapproche par SIREN / SIRET / TVA et remplit les identifiants manquants depuis la base Sirene officielle."
      heroIcon={<svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>}
      screenshot="/screenshots/dashboard-donnees.png"
      keyBenefits={[
        { title: "Audit automatique", desc: "Complétude par propriété, doublons, fiches orphelines — tout est détecté et scoré automatiquement, avec un plan d'action IA priorisé." },
        { title: "Rapprochement à la française", desc: "SIREN, SIRET, N° TVA, email, domaine et ID custom : une vue unique par entreprise entre CRM, facturation et compta." },
        { title: "Enrichissement Sirene", desc: "Les identifiants manquants sont remplis depuis la base Sirene officielle, validés par vous en un clic — et écrits aussi dans HubSpot." },
      ]}
      teams={[
        { team: "Direction", icon: teamIcon("M3 3v18h18"), pain: "Les décisions sont prises sur des données dont personne ne garantit la fiabilité.", solution: "Score de santé global des données avec tendance. Alerte si la qualité se dégrade.", result: "Confiance dans les chiffres présentés en board et comité de direction." },
        { team: "Marketing", icon: teamIcon("M3 3v18h18M7 16l4-8 4 4 4-8"), pain: "40% des leads sont invalides ou doublons. Les campagnes ciblent des fantômes.", solution: "Dédoublonnage cross-source + complétude par propriété + détection de fiches invalides.", result: "Base marketing propre. Meilleur taux de conversion, moins de gaspillage." },
        { team: "Sales", icon: teamIcon("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"), pain: "13h/semaine perdues à chercher la bonne info dans le CRM.", solution: "Fiches rapprochées et enrichies via Sirene, validées en un clic, écrites dans HubSpot.", result: "Temps commercial libéré pour vendre. Données à jour sans effort." },
        { team: "RevOps", icon: teamIcon("M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83"), pain: "Nettoyage de données manuel, récurrent, sans fin. Scripts custom fragiles.", solution: "Rapprochement automatique par identifiants légaux + audit à chaque sync + plan d'action IA.", result: "Data ops automatisé. Le RevOps pilote la stratégie, pas la plomberie." },
        { team: "CSM", icon: teamIcon("M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"), pain: "Fiches clients incomplètes. Pas d'historique unifié entre CRM et facturation.", solution: "Résolution d'entités : le client est le même chez HubSpot, Stripe et Pennylane.", result: "Vue 360° du client. Onboarding et suivi personnalisés." },
        { team: "Finance", icon: teamIcon("M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 1-4 4v14a3 3 0 0 0 3-3h7z"), pain: "Les données de facturation ne matchent pas avec le CRM. Réconciliation manuelle chaque mois.", solution: "Rapprochement automatique factures Stripe / Pennylane × entreprises CRM par SIREN / N° TVA.", result: "Réconciliation des revenus automatique. Clôture comptable accélérée." },
      ]}
      relatedProducts={[
        { label: "Audit complet du CRM", href: "/produits/audit-crm" },
        { label: "Résolution d'entités", href: "/produits/resolution-entites" },
        { label: "Synchronisation de données", href: "/produits/synchronisation" },
      ]}
    />
  );
}
