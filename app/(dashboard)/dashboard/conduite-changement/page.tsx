import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";

const HUBSPOT_PORTAL = "48372600";

type Owner = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  userId: number | null;
  updatedAt: string;
  teams: string[];
};

export default async function ConduiteChangementPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  let owners: Owner[] = [];
  let dealsPerOwnerId: Record<string, number> = {};
  let contactsPerOwnerId: Record<string, number> = {};

  if (process.env.HUBSPOT_ACCESS_TOKEN) {
    try {
      // Get all owners
      const ownerRes = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
        headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` },
      });
      if (ownerRes.ok) {
        const ownerData = await ownerRes.json();
        owners = (ownerData.results ?? []).map((o: Record<string, unknown>) => ({
          id: o.id as string,
          email: o.email as string,
          firstName: (o.firstName as string) || "",
          lastName: (o.lastName as string) || "",
          userId: (o.userId as number) || null,
          updatedAt: (o.updatedAt as string) || (o.createdAt as string) || "",
          teams: ((o.teams as Array<{ name: string }>) ?? []).map((t) => t.name),
        }));

        // Count deals + contacts per owner via Search API
        const countPromises = owners.flatMap((o) => [
          fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }],
              limit: 1,
            }),
          }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, type: "deal", count: d.total ?? 0 })),
          fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
            method: "POST",
            headers: { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }],
              limit: 1,
            }),
          }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, type: "contact", count: d.total ?? 0 })),
        ]);

        const results = await Promise.all(countPromises);
        results.forEach((r) => {
          if (r.type === "deal") dealsPerOwnerId[r.ownerId] = r.count;
          else contactsPerOwnerId[r.ownerId] = r.count;
        });
      }
    } catch {
      // Silently fail
    }
  }

  // Compute team distribution
  const teamDistribution: Record<string, number> = {};
  owners.forEach((o) => {
    o.teams.forEach((t) => { teamDistribution[t] = (teamDistribution[t] || 0) + 1; });
    if (o.teams.length === 0) teamDistribution["Sans équipe"] = (teamDistribution["Sans équipe"] || 0) + 1;
  });
  const sortedTeams = Object.entries(teamDistribution).sort((a, b) => b[1] - a[1]);

  // Activity classification
  const now = Date.now();
  const ownersWithActivity = owners.map((o) => {
    const lastUpdate = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
    const daysSince = Math.round((now - lastUpdate) / (1000 * 60 * 60 * 24));
    const deals = dealsPerOwnerId[o.id] || 0;
    const contacts = contactsPerOwnerId[o.id] || 0;
    const totalRecords = deals + contacts;
    return { ...o, daysSinceUpdate: daysSince, deals, contacts, totalRecords };
  });

  const activeUsers = ownersWithActivity.filter((o) => o.daysSinceUpdate < 60 && o.totalRecords > 0);
  const inactiveUsers = ownersWithActivity.filter((o) => o.daysSinceUpdate >= 60 || o.totalRecords === 0);
  const ghostUsers = ownersWithActivity.filter((o) => o.totalRecords === 0);

  // Top users
  const topUsers = [...ownersWithActivity].sort((a, b) => b.totalRecords - a.totalRecords).slice(0, 10);

  // Adoption score
  const adoptionScore = owners.length > 0
    ? Math.round((activeUsers.length / owners.length) * 100)
    : 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Conduite du changement</h1>
        <p className="mt-1 text-sm text-slate-500">
          Adoption de l&apos;outil par les équipes et activité des utilisateurs.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Adoption" score={adoptionScore} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{adoptionScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(adoptionScore).className}`}>
              {getScoreLabel(adoptionScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {activeUsers.length} utilisateurs actifs sur {owners.length} comptes du portail.
          </p>
        </div>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Utilisateurs CRM</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{owners.length}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Utilisateurs actifs</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">{activeUsers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Activité &lt; 60 jours</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Utilisateurs inactifs</p>
          <p className={`mt-1 text-3xl font-bold ${inactiveUsers.length > owners.length * 0.5 ? "text-red-500" : "text-orange-500"}`}>{inactiveUsers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Activité &gt; 60 jours</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Comptes fantômes</p>
          <p className={`mt-1 text-3xl font-bold ${ghostUsers.length > 0 ? "text-red-500" : "text-emerald-600"}`}>{ghostUsers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Aucune donnée associée</p>
        </article>
      </div>

      {/* Utilisateurs par équipe */}
      {sortedTeams.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-violet-500" />Utilisateurs par équipe
            </h2>
          }
        >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {sortedTeams.map(([team, count]) => (
              <article key={team} className="card p-4">
                <p className="text-sm font-medium text-slate-800">{team}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{count}</p>
                <p className="text-xs text-slate-400">utilisateur{count > 1 ? "s" : ""}</p>
              </article>
            ))}
          </div>
        </CollapsibleBlock>
      )}

      {/* Top utilisateurs actifs */}
      {topUsers.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />Top utilisateurs par volume de données
            </h2>
          }
        >
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-5 py-2">Utilisateur</th>
                  <th className="px-5 py-2">Équipes</th>
                  <th className="px-5 py-2 text-right">Contacts</th>
                  <th className="px-5 py-2 text-right">Transactions</th>
                  <th className="px-5 py-2 text-right">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((o) => (
                  <tr key={o.id} className="border-b border-card-border last:border-0">
                    <td className="px-5 py-2.5">
                      <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {o.teams.length > 0 ? o.teams.slice(0, 2).map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
                        )) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-2.5 text-right text-slate-700">{o.contacts.toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-2.5 text-right text-slate-700">{o.deals.toLocaleString("fr-FR")}</td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`text-xs ${o.daysSinceUpdate < 30 ? "text-emerald-600" : o.daysSinceUpdate < 90 ? "text-yellow-600" : "text-red-500"}`}>
                        Il y a {o.daysSinceUpdate}j
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      )}

      {/* Comptes fantômes / inactifs */}
      {ghostUsers.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-red-500" />Comptes sans activité
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{ghostUsers.length}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">Utilisateurs qui n&apos;ont aucun contact ni transaction associé. Candidats pour désactivation.</p>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {ghostUsers.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                    <p className="text-xs text-slate-400">{o.email}</p>
                  </div>
                  <span className="text-xs text-red-600">Aucune donnée</span>
                </div>
              ))}
            </div>
          </div>
          <a href={`https://app.hubspot.com/settings/${HUBSPOT_PORTAL}/users`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500">
            Gérer les utilisateurs dans HubSpot
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </CollapsibleBlock>
      )}

      {!process.env.HUBSPOT_ACCESS_TOKEN && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Connectez votre token HubSpot pour voir l&apos;activité des utilisateurs.</p>
        </div>
      )}
    </section>
  );
}
