import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";
import { ProgressScore } from "@/components/progress-score";
import { getScoreLabel, getBarColor } from "@/lib/score-utils";
import { CollapsibleBlock } from "@/components/collapsible-block";

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Aucune organisation configurée.</p>;
  }

  const supabase = await createSupabaseServerClient();

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

  // Global data quality score
  const allRates = [...contactMetrics, ...companyMetrics, ...dealMetrics].map((m) => m.filled);
  const dataScore = allRates.length > 0 ? Math.round(allRates.reduce((s, r) => s + r, 0) / allRates.length) : 0;

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Données</h1>
        <p className="mt-1 text-sm text-slate-500">
          Qualité et enrichissement des données CRM.
        </p>
      </header>

      <div className="card flex flex-col items-center gap-6 p-6 md:flex-row">
        <ProgressScore label="Score Data Quality" score={dataScore} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-slate-900">{dataScore}</span>
            <span className="text-sm text-slate-400">/100</span>
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getScoreLabel(dataScore).className}`}>
              {getScoreLabel(dataScore).label}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            Moyenne du taux de remplissage des champs clés sur les contacts, entreprises et transactions.
          </p>
        </div>
      </div>

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
    </section>
  );
}
