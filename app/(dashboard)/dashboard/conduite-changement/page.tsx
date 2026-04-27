export const dynamic = "force-dynamic";

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { fetchOwnersFromCache } from "./context";

export default async function AdoptionOverviewPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  // Lecture cache : owners depuis hubspot_objects, KPIs depuis snapshot
  const [owners, snapshot] = await Promise.all([
    fetchOwnersFromCache(supabase, orgId),
    getHubspotSnapshot(),
  ]);

  if (snapshot.status === "no-token") {
    return <p className="p-6 text-center text-sm text-slate-500">Connectez votre CRM HubSpot.</p>;
  }

  // Activités totales : on dérive des données disponibles dans le snapshot.
  // sequencesEnrollments + (deals avec notes / activities loguées) sont
  // les proxies les plus représentatifs sans appel /engagements live.
  const totalActivities = snapshot.sequencesEnrollments + Math.max(0, snapshot.totalDeals - snapshot.dealsNoNextActivity);
  // Owners "actifs" = ceux qui ont au moins 1 deal en cours OU 1 activité.
  // Sans agrégation par owner dans le snapshot, on prend une heuristique
  // simple : si au moins un deal et N owners, on assume répartition.
  const activeUsers = owners.length > 0
    ? Math.min(owners.length, Math.max(1, Math.round(snapshot.openDeals / Math.max(1, owners.length / 2))))
    : 0;

  const cards = [
    { href: "/dashboard/conduite-changement/activites", label: "Équipes", description: "Appels, emails, RDV, notes et tâches par équipe et par utilisateur", stat: `${totalActivities.toLocaleString("fr-FR")} activités`, color: "text-emerald-500",
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" /></svg> },
    { href: "/dashboard/conduite-changement/assets", label: "Assets", description: "Workflows et propriétés créés par utilisateur sur tous les objets CRM", stat: `${owners.length} utilisateurs`, color: "text-indigo-500",
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9c0-.5-.23-1-.64-1.32l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06c.32.41.82.64 1.32.64h.18A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51c.5 0 1-.23 1.32-.64l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06c-.41.32-.64.82-.64 1.32v.18a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> },
    { href: "/dashboard/conduite-changement/connexions", label: "Suivi", description: "Records sans activité récente, contacts et deals à relancer", stat: `${activeUsers} actifs / ${owners.length}`, color: "text-orange-500",
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="card group flex flex-col gap-3 p-5 transition hover:border-accent/30 hover:shadow-md">
            <div className="flex items-center justify-between">
              {c.icon}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300 group-hover:text-accent transition"><polyline points="9 18 15 12 9 6" /></svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 group-hover:text-accent transition">{c.label}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{c.description}</p>
            </div>
            <p className={`text-sm font-semibold ${c.color}`}>{c.stat}</p>
          </Link>
        ))}
      </div>
  );
}
