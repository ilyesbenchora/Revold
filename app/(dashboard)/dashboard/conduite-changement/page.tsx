import { getOrgId } from "@/lib/supabase/cached";
import { InsightLockedBlock } from "@/components/insight-locked-block";
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

type AssetStats = {
  workflows: number;
  forms: number;
  propertiesContact: number;
  propertiesCompany: number;
  propertiesDeal: number;
};

type RecordStats = {
  contacts: number;
  companies: number;
  deals: number;
};

export default async function AdoptionPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return (
      <section className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
          <p className="mt-1 text-sm text-slate-500">Connectez votre CRM HubSpot pour analyser l&apos;adoption.</p>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">Connectez votre token HubSpot pour voir l&apos;activité des utilisateurs.</p>
        </div>
      </section>
    );
  }

  let owners: Owner[] = [];
  const assetsPerUser: Record<number, AssetStats> = {};
  const recordsPerOwner: Record<string, RecordStats> = {};

  try {
    // ── 1. Get all owners ──
    const ownerRes = await fetch("https://api.hubapi.com/crm/v3/owners?limit=100", {
      headers: { Authorization: `Bearer ${token}` },
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
    }

    // ── 2. Fetch assets created by users (workflows, forms, properties) ──
    const [wfRes, formRes, propsContact, propsCompany, propsDeal] = await Promise.all([
      fetch("https://api.hubapi.com/automation/v4/flows?limit=100", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("https://api.hubapi.com/marketing/v3/forms?limit=100", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("https://api.hubapi.com/crm/v3/properties/contacts", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("https://api.hubapi.com/crm/v3/properties/companies", { headers: { Authorization: `Bearer ${token}` } }),
      fetch("https://api.hubapi.com/crm/v3/properties/deals", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    // Count workflows per creator
    if (wfRes.ok) {
      const wfData = await wfRes.json();
      for (const wf of (wfData.results ?? [])) {
        const uid = wf.createdById ?? wf.userId ?? null;
        if (uid) {
          if (!assetsPerUser[uid]) assetsPerUser[uid] = { workflows: 0, forms: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0 };
          assetsPerUser[uid].workflows++;
        }
      }
    }

    // Count forms per creator
    if (formRes.ok) {
      const formData = await formRes.json();
      for (const f of (formData.results ?? [])) {
        const uid = f.createdById ?? f.userId ?? null;
        if (uid) {
          if (!assetsPerUser[uid]) assetsPerUser[uid] = { workflows: 0, forms: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0 };
          assetsPerUser[uid].forms++;
        }
      }
    }

    // Count custom properties per creator per object type
    const propSources: Array<{ res: Response; field: "propertiesContact" | "propertiesCompany" | "propertiesDeal" }> = [
      { res: propsContact, field: "propertiesContact" },
      { res: propsCompany, field: "propertiesCompany" },
      { res: propsDeal, field: "propertiesDeal" },
    ];
    for (const { res, field } of propSources) {
      if (res.ok) {
        const data = await res.json();
        for (const p of (data.results ?? [])) {
          if (p.hubspotDefined) continue; // Only user-created properties
          const uid = p.createdUserId ?? null;
          if (uid) {
            if (!assetsPerUser[uid]) assetsPerUser[uid] = { workflows: 0, forms: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0 };
            assetsPerUser[uid][field]++;
          }
        }
      }
    }

    // ── 3. Records per owner (contacts, companies, deals) ──
    const searchPromises = owners.flatMap((o) => [
      fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }], limit: 1 }),
      }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, type: "contacts" as const, count: d.total ?? 0 })),
      fetch("https://api.hubapi.com/crm/v3/objects/companies/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }], limit: 1 }),
      }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, type: "companies" as const, count: d.total ?? 0 })),
      fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "EQ", value: o.id }] }], limit: 1 }),
      }).then((r) => r.ok ? r.json() : { total: 0 }).then((d) => ({ ownerId: o.id, type: "deals" as const, count: d.total ?? 0 })),
    ]);

    const results = await Promise.all(searchPromises);
    for (const r of results) {
      if (!recordsPerOwner[r.ownerId]) recordsPerOwner[r.ownerId] = { contacts: 0, companies: 0, deals: 0 };
      recordsPerOwner[r.ownerId][r.type] = r.count;
    }
  } catch {}

  // ── Compute metrics ──
  const now = Date.now();
  const ownersEnriched = owners.map((o) => {
    const lastUpdate = o.updatedAt ? new Date(o.updatedAt).getTime() : 0;
    const daysSince = Math.round((now - lastUpdate) / 86400000);
    const records = recordsPerOwner[o.id] ?? { contacts: 0, companies: 0, deals: 0 };
    const assets = o.userId ? (assetsPerUser[o.userId] ?? { workflows: 0, forms: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0 }) : { workflows: 0, forms: 0, propertiesContact: 0, propertiesCompany: 0, propertiesDeal: 0 };
    const totalRecords = records.contacts + records.companies + records.deals;
    const totalAssets = assets.workflows + assets.forms + assets.propertiesContact + assets.propertiesCompany + assets.propertiesDeal;
    return { ...o, daysSinceUpdate: daysSince, records, assets, totalRecords, totalAssets };
  });

  const teamDistribution: Record<string, number> = {};
  owners.forEach((o) => {
    o.teams.forEach((t) => { teamDistribution[t] = (teamDistribution[t] || 0) + 1; });
    if (o.teams.length === 0) teamDistribution["Sans équipe"] = (teamDistribution["Sans équipe"] || 0) + 1;
  });
  const sortedTeams = Object.entries(teamDistribution).sort((a, b) => b[1] - a[1]);

  const activeUsers = ownersEnriched.filter((o) => o.daysSinceUpdate < 60 && o.totalRecords > 0);
  const ghostUsers = ownersEnriched.filter((o) => o.totalRecords === 0 && o.totalAssets === 0);

  const topAssetCreators = [...ownersEnriched].filter((o) => o.totalAssets > 0).sort((a, b) => b.totalAssets - a.totalAssets).slice(0, 10);
  const topRecordCreators = [...ownersEnriched].filter((o) => o.totalRecords > 0).sort((a, b) => b.totalRecords - a.totalRecords).slice(0, 10);

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
        <p className="mt-1 text-sm text-slate-500">
          Adoption du CRM par les équipes : assets créés, données saisies et activité par utilisateur.
        </p>
      </header>

      <InsightLockedBlock />

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
          <p className="text-xs text-slate-500">Créateurs d&apos;assets</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{topAssetCreators.length}</p>
          <p className="mt-1 text-xs text-slate-400">Workflows, formulaires, propriétés</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Comptes fantômes</p>
          <p className={`mt-1 text-3xl font-bold ${ghostUsers.length > 0 ? "text-red-500" : "text-emerald-600"}`}>{ghostUsers.length}</p>
          <p className="mt-1 text-xs text-slate-400">Aucune donnée ni asset</p>
        </article>
      </div>

      {/* Utilisateurs par équipe */}
      {sortedTeams.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-violet-500" />Utilisateurs par équipe</h2>}
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

      {/* Top créateurs d'assets */}
      {topAssetCreators.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-indigo-500" />Assets créés par utilisateur</h2>}
        >
          <p className="text-sm text-slate-500">Formulaires, workflows et propriétés personnalisées créés par chaque utilisateur.</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2 text-right">Workflows</th>
                  <th className="px-4 py-2 text-right">Formulaires</th>
                  <th className="px-4 py-2 text-right">Prop. Contacts</th>
                  <th className="px-4 py-2 text-right">Prop. Entreprises</th>
                  <th className="px-4 py-2 text-right">Prop. Transactions</th>
                  <th className="px-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {topAssetCreators.map((o) => (
                  <tr key={o.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets.workflows || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets.forms || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets.propertiesContact || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets.propertiesCompany || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.assets.propertiesDeal || <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{o.totalAssets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleBlock>
      )}

      {/* Top créateurs de données */}
      {topRecordCreators.length > 0 && (
        <CollapsibleBlock
          title={<h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" />Données par utilisateur</h2>}
        >
          <p className="text-sm text-slate-500">Nombre de contacts, entreprises et transactions associés à chaque utilisateur.</p>
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <th className="px-4 py-2">Utilisateur</th>
                  <th className="px-4 py-2">Équipes</th>
                  <th className="px-4 py-2 text-right">Contacts</th>
                  <th className="px-4 py-2 text-right">Entreprises</th>
                  <th className="px-4 py-2 text-right">Transactions</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  <th className="px-4 py-2 text-right">Dernière activité</th>
                </tr>
              </thead>
              <tbody>
                {topRecordCreators.map((o) => (
                  <tr key={o.id} className="border-b border-card-border last:border-0">
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                      <p className="text-xs text-slate-400">{o.email}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {o.teams.length > 0 ? o.teams.slice(0, 2).map((t) => (
                          <span key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{t}</span>
                        )) : <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.records.contacts.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.records.companies.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{o.records.deals.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">{o.totalRecords.toLocaleString("fr-FR")}</td>
                    <td className="px-4 py-2.5 text-right">
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

      {/* Comptes fantômes */}
      {ghostUsers.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-red-500" />Comptes sans activité
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{ghostUsers.length}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">Utilisateurs sans aucun contact, entreprise, transaction, workflow ou propriété créé. Candidats pour désactivation.</p>
          <div className="card overflow-hidden">
            <div className="divide-y divide-card-border">
              {ghostUsers.map((o) => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{o.firstName} {o.lastName}</p>
                    <p className="text-xs text-slate-400">{o.email}</p>
                  </div>
                  <span className="text-xs text-red-600">Aucune donnée ni asset</span>
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
    </section>
  );
}
