import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser, getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";

const inputClass = "mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;
const readOnlyClass = "mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-600";

export default async function ParametresGeneralPage() {
  const orgId = await getOrgId();
  const user = await getAuthUser();
  if (!orgId || !user) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: org }, { data: profiles }, { data: stages }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("profiles").select("id, full_name, role, created_at").eq("organization_id", orgId).order("created_at"),
    supabase.from("pipeline_stages").select("*").eq("organization_id", orgId).order("position"),
  ]);

  const team = profiles ?? [];
  const pipelineStages = stages ?? [];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">Configuration générale de votre espace Revold.</p>
      </header>

      <ParametresTabs />

      {/* Organisation */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-indigo-500" />Organisation
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Nom de l&apos;organisation</label>
              <input type="text" name="org_name" defaultValue={org?.name ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Slug</label>
              <input type="text" name="org_slug" defaultValue={org?.slug ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Plan actif</label>
              <input type="text" defaultValue={(org?.plan ?? "trial").toUpperCase()} readOnly className={readOnlyClass + " font-semibold text-indigo-700"} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Devise</label>
              <select name="currency" defaultValue="EUR" className={selectClass}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (Fr.)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Début d&apos;année fiscale</label>
              <select name="fiscal_year_start" defaultValue="1" className={selectClass}>
                <option value="1">Janvier</option>
                <option value="4">Avril</option>
                <option value="7">Juillet</option>
                <option value="10">Octobre</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Fuseau horaire</label>
              <select name="timezone" defaultValue="Europe/Paris" className={selectClass}>
                <option value="Europe/Paris">Europe/Paris (UTC+1)</option>
                <option value="Europe/London">Europe/London (UTC+0)</option>
                <option value="Europe/Brussels">Europe/Brussels (UTC+1)</option>
                <option value="America/New_York">America/New_York (UTC-5)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (UTC-8)</option>
                <option value="America/Montreal">America/Montreal (UTC-5)</option>
                <option value="Asia/Dubai">Asia/Dubai (UTC+4)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Objectif trimestriel (€)</label>
              <input type="number" name="quarterly_target" defaultValue={org?.quarterly_target ? Number(org.quarterly_target) : ""} placeholder="2000000" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">HubSpot Portal ID</label>
              <input type="text" name="hubspot_portal_id" defaultValue={org?.hubspot_portal_id ?? ""} placeholder="48372600" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Pays de l&apos;organisation</label>
              <select name="country" defaultValue="FR" className={selectClass}>
                <option value="FR">France</option>
                <option value="BE">Belgique</option>
                <option value="CH">Suisse</option>
                <option value="CA">Canada</option>
                <option value="US">États-Unis</option>
                <option value="GB">Royaume-Uni</option>
                <option value="DE">Allemagne</option>
                <option value="ES">Espagne</option>
                <option value="LU">Luxembourg</option>
                <option value="MA">Maroc</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">SIREN de l&apos;organisation</label>
              <input type="text" name="org_siren" placeholder="123 456 789" maxLength={11} className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">9 chiffres — utilisé pour le rapprochement automatique entre outils</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">N° TVA intracommunautaire</label>
              <input type="text" name="org_vat" placeholder="FR12345678901" maxLength={15} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Secteur d&apos;activité</label>
              <select name="industry" defaultValue="" className={selectClass}>
                <option value="">Non renseigné</option>
                <option value="saas">SaaS / Logiciel</option>
                <option value="services">Services B2B</option>
                <option value="ecommerce">E-commerce</option>
                <option value="manufacturing">Industrie / Manufacturing</option>
                <option value="finance">Finance / Assurance</option>
                <option value="health">Santé</option>
                <option value="education">Éducation</option>
                <option value="consulting">Conseil</option>
                <option value="agency">Agence</option>
                <option value="other">Autre</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer les modifications
            </button>
          </div>
        </div>
      </div>

      {/* Équipe */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Équipe
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{team.length}</span>
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Nom</th>
                <th className="px-5 py-2">Rôle</th>
                <th className="px-5 py-2">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{m.full_name}</td>
                  <td className="px-5 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.role === "admin" ? "bg-indigo-50 text-indigo-700" : "bg-slate-100 text-slate-600"}`}>
                      {m.role}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-slate-500">
                    {m.created_at ? new Date(m.created_at).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
              {team.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-4 text-center text-slate-400">Aucun membre.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Pipeline de vente
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{pipelineStages.length} étapes</span>
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Position</th>
                <th className="px-5 py-2">Nom</th>
                <th className="px-5 py-2">Probabilité</th>
                <th className="px-5 py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {pipelineStages.map((s) => (
                <tr key={s.id} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 text-slate-500">{s.position}</td>
                  <td className="px-5 py-2.5 font-medium text-slate-800">{s.name}</td>
                  <td className="px-5 py-2.5 text-slate-600">{Number(s.probability)}%</td>
                  <td className="px-5 py-2.5">
                    {s.is_closed_won ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Gagné</span>
                    ) : s.is_closed_lost ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Perdu</span>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">En cours</span>
                    )}
                  </td>
                </tr>
              ))}
              {pipelineStages.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-4 text-center text-slate-400">Aucune étape configurée. Synchronisez HubSpot pour importer votre pipeline.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
