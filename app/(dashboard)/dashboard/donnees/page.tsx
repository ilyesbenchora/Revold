import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getCanonicalIntegrationData } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { InsightLockedBlock } from "@/components/insight-locked-block";
import { CollapsibleBlock } from "@/components/collapsible-block";
import { filterBusinessIntegrations } from "@/lib/integrations/integration-score";
import { ExpandableIntegrationsList } from "@/components/expandable-integrations-list";

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

  // HubSpot-detected business integrations (for the connected apps block)
  const { integrations: hsIntegrations } = await getCanonicalIntegrationData();
  const businessIntegrations = filterBusinessIntegrations(hsIntegrations);

  // Contact data quality
  const [
    { count: totalContacts },
    { count: contactsWithPhone },
    { count: contactsWithTitle },
    { count: contactsWithCompany },
    { count: contactsWithEmail },
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("phone", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("title", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("company_id", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("email", "is", null),
  ]);

  // Company data quality
  const [
    { count: totalCompanies },
    { count: companiesWithDomain },
    { count: companiesWithIndustry },
    { count: companiesWithRevenue },
    { count: companiesWithEmployees },
  ] = await Promise.all([
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("domain", "is", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("industry", "is", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("annual_revenue", "is", null),
    supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("employee_count", "is", null),
  ]);

  // Deal data quality
  const [
    { count: totalDeals },
    { count: dealsWithAmount },
    { count: dealsWithCloseDate },
    { count: dealsWithContact },
  ] = await Promise.all([
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("amount", 0),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).not("close_date", "is", null),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gt("associated_contacts_count", 0),
  ]);

  const tc = totalContacts ?? 0;
  const tco = totalCompanies ?? 0;
  const td = totalDeals ?? 0;

  function rate(filled: number | null, total: number): number {
    return total > 0 ? Math.round(((filled ?? 0) / total) * 100) : 0;
  }

  // Contact quality metrics
  const contactMetrics = [
    { label: "Email renseigné", filled: rate(contactsWithEmail, tc) },
    { label: "Téléphone renseigné", filled: rate(contactsWithPhone, tc) },
    { label: "Poste renseigné", filled: rate(contactsWithTitle, tc) },
    { label: "Entreprise associée", filled: rate(contactsWithCompany, tc) },
  ];

  // Company quality metrics
  const companyMetrics = [
    { label: "Domaine renseigné", filled: rate(companiesWithDomain, tco) },
    { label: "Secteur renseigné", filled: rate(companiesWithIndustry, tco) },
    { label: "Chiffre d'affaires renseigné", filled: rate(companiesWithRevenue, tco) },
    { label: "Effectifs renseignés", filled: rate(companiesWithEmployees, tco) },
  ];

  // Deal quality metrics
  const dealMetrics = [
    { label: "Montant renseigné", filled: rate(dealsWithAmount, td) },
    { label: "Date de closing renseignée", filled: rate(dealsWithCloseDate, td) },
    { label: "Contact associé", filled: rate(dealsWithContact, td) },
  ];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Données</h1>
        <p className="mt-1 text-sm text-slate-500">
          Qualité et enrichissement des données CRM.
        </p>
      </header>

      <InsightLockedBlock />

      {/* Vue d'ensemble */}
      <div className="grid grid-cols-3 gap-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Contacts</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{tc.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Entreprises</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{tco.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Transactions</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{td.toLocaleString("fr-FR")}</p>
        </article>
      </div>

      {/* Qualité contacts */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-blue-500" />Enrichissement des contacts
            <span className="text-sm font-normal text-slate-400">({tc.toLocaleString("fr-FR")} contacts)</span>
          </h2>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {contactMetrics.map((m) => (
            <article key={m.label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">{m.label}</p>
                <span className={`text-sm font-bold ${m.filled >= 80 ? "text-emerald-600" : m.filled >= 50 ? "text-yellow-600" : m.filled >= 30 ? "text-orange-500" : "text-red-500"}`}>{m.filled}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${getBarColor(m.filled)}`} style={{ width: `${m.filled}%` }} />
              </div>
            </article>
          ))}
        </div>
      </CollapsibleBlock>

      {/* Qualité entreprises */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-violet-500" />Enrichissement des entreprises
            <span className="text-sm font-normal text-slate-400">({tco.toLocaleString("fr-FR")} entreprises)</span>
          </h2>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {companyMetrics.map((m) => (
            <article key={m.label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">{m.label}</p>
                <span className={`text-sm font-bold ${m.filled >= 80 ? "text-emerald-600" : m.filled >= 50 ? "text-yellow-600" : m.filled >= 30 ? "text-orange-500" : "text-red-500"}`}>{m.filled}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${getBarColor(m.filled)}`} style={{ width: `${m.filled}%` }} />
              </div>
            </article>
          ))}
        </div>
      </CollapsibleBlock>

      {/* Qualité transactions */}
      <CollapsibleBlock
        title={
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="h-2 w-2 rounded-full bg-orange-500" />Enrichissement des transactions
            <span className="text-sm font-normal text-slate-400">({td.toLocaleString("fr-FR")} transactions)</span>
          </h2>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {dealMetrics.map((m) => (
            <article key={m.label} className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-700">{m.label}</p>
                <span className={`text-sm font-bold ${m.filled >= 80 ? "text-emerald-600" : m.filled >= 50 ? "text-yellow-600" : m.filled >= 30 ? "text-orange-500" : "text-red-500"}`}>{m.filled}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${getBarColor(m.filled)}`} style={{ width: `${m.filled}%` }} />
              </div>
            </article>
          ))}
        </div>
      </CollapsibleBlock>

      {/* Applications connectées à HubSpot */}
      {businessIntegrations.length > 0 && (
        <CollapsibleBlock
          title={
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <span className="h-2 w-2 rounded-full bg-violet-500" />Applications connectées à HubSpot
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">{businessIntegrations.length}</span>
            </h2>
          }
        >
          <p className="text-sm text-slate-500">
            Outils métiers connectés à votre portail HubSpot, détectés via les propriétés installées, les sources d&apos;enregistrement et l&apos;activité API.
          </p>
          <ExpandableIntegrationsList totalCount={businessIntegrations.length} visibleByDefault={4}>
            {businessIntegrations.map((int) => (
              <article key={int.key} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{int.icon}</span>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{int.label}</h3>
                      <p className="text-xs text-slate-400">{int.vendor}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">Propriétés</p>
                    <p className="text-2xl font-bold text-slate-900">{int.totalProperties}</p>
                  </div>
                </div>
                {int.totalProperties > 0 && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">Taux d&apos;enrichissement</span>
                      <span className={`font-bold ${
                        int.enrichmentRate >= 50 ? "text-emerald-600" :
                        int.enrichmentRate >= 20 ? "text-yellow-600" : "text-orange-500"
                      }`}>{int.enrichmentRate}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
                      <div className={`h-2 rounded-full ${getBarColor(int.enrichmentRate)}`} style={{ width: `${Math.min(100, int.enrichmentRate)}%` }} />
                    </div>
                  </div>
                )}
              </article>
            ))}
          </ExpandableIntegrationsList>
        </CollapsibleBlock>
      )}
    </section>
  );
}
