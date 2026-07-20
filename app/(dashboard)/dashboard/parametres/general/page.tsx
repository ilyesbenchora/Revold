export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser, getOrgId } from "@/lib/supabase/cached";
import { ParametresTabs } from "@/components/parametres-tabs";
import { updateFiscalSettings, updateOrganisation } from "./actions";

const inputClass = "mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;
const readOnlyClass = "mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-600";

export default async function ParametresGeneralPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const orgId = await getOrgId();
  const user = await getAuthUser();
  if (!orgId || !user) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: org }, { data: profiles }] = await Promise.all([
    supabase.from("organizations").select("*").eq("id", orgId).single(),
    supabase.from("profiles").select("id, full_name, role, created_at").eq("organization_id", orgId).order("created_at"),
  ]);

  const team = profiles ?? [];

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
          Organisation
        </h2>
        {sp.saved === "org" && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Organisation enregistrée.
          </p>
        )}
        {sp.error === "org_save" && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            Enregistrement impossible. Vérifie que la migration des champs organisation a bien été appliquée.
          </p>
        )}
        <form action={updateOrganisation} className="card p-6">
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
              <select name="currency" defaultValue={org?.currency ?? "EUR"} className={selectClass}>
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CHF">CHF (Fr.)</option>
                <option value="CAD">CAD ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Début d&apos;année fiscale</label>
              <select name="fiscal_year_start" defaultValue={org?.fiscal_year_start != null ? String(org.fiscal_year_start) : "1"} className={selectClass}>
                <option value="1">Janvier</option>
                <option value="4">Avril</option>
                <option value="7">Juillet</option>
                <option value="10">Octobre</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Fuseau horaire</label>
              <select name="timezone" defaultValue={org?.timezone ?? "Europe/Paris"} className={selectClass}>
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
              <select name="country" defaultValue={org?.country ?? "FR"} className={selectClass}>
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
              <input type="text" name="org_siren" defaultValue={org?.siren ?? ""} placeholder="123 456 789" maxLength={11} className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">9 chiffres — utilisé pour le rapprochement automatique entre outils</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">N° TVA intracommunautaire</label>
              <input type="text" name="org_vat" defaultValue={org?.vat ?? ""} placeholder="FR12345678901" maxLength={15} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Secteur d&apos;activité</label>
              <select name="industry" defaultValue={org?.industry ?? ""} className={selectClass}>
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
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>

      {/* Fiscalité & échéances — alimente la table « Échéances fiscales » du funnel Trésorerie */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Fiscalité &amp; échéances
        </h2>
        <p className="-mt-1 text-sm text-slate-500">
          Ces paramètres alimentent la table de données « Échéances fiscales (TVA · IS · URSSAF) »
          proposée dans le funnel de la page Trésorerie.
        </p>
        {sp.saved === "fiscal" && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            Échéances fiscales enregistrées.
          </p>
        )}
        {sp.error === "fiscal_save" && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            Enregistrement impossible. Vérifie que la migration fiscale a bien été appliquée.
          </p>
        )}
        <form action={updateFiscalSettings} className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {/* TVA */}
            <div>
              <label className="text-xs font-medium text-slate-500">TVA — périodicité</label>
              <select name="fiscal_tva_periodicite" defaultValue={org?.fiscal_tva_periodicite ?? "mensuelle"} className={selectClass}>
                <option value="mensuelle">Mensuelle (CA3)</option>
                <option value="trimestrielle">Trimestrielle</option>
                <option value="annuelle">Annuelle (RSI)</option>
                <option value="franchise">Franchise en base</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">TVA — prochaine échéance</label>
              <input type="date" name="fiscal_tva_prochaine" defaultValue={org?.fiscal_tva_prochaine ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">TVA — montant estimé (€)</label>
              <input type="number" name="fiscal_tva_montant" defaultValue={org?.fiscal_tva_montant ?? ""} placeholder="0" className={inputClass} />
            </div>

            {/* IS */}
            <div>
              <label className="text-xs font-medium text-slate-500">IS — périodicité des acomptes</label>
              <select name="fiscal_is_periodicite" defaultValue={org?.fiscal_is_periodicite ?? "trimestriel"} className={selectClass}>
                <option value="trimestriel">Acomptes trimestriels (15/03·06·09·12)</option>
                <option value="annuel">Solde annuel uniquement</option>
                <option value="exonere">Exonéré / non applicable</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">IS — prochaine échéance</label>
              <input type="date" name="fiscal_is_prochaine" defaultValue={org?.fiscal_is_prochaine ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">IS — montant estimé (€)</label>
              <input type="number" name="fiscal_is_montant" defaultValue={org?.fiscal_is_montant ?? ""} placeholder="0" className={inputClass} />
            </div>

            {/* URSSAF */}
            <div>
              <label className="text-xs font-medium text-slate-500">URSSAF — périodicité</label>
              <select name="fiscal_urssaf_periodicite" defaultValue={org?.fiscal_urssaf_periodicite ?? "mensuelle"} className={selectClass}>
                <option value="mensuelle">Mensuelle</option>
                <option value="trimestrielle">Trimestrielle</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">URSSAF — prochaine échéance</label>
              <input type="date" name="fiscal_urssaf_prochaine" defaultValue={org?.fiscal_urssaf_prochaine ?? ""} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">URSSAF — montant estimé (€)</label>
              <input type="number" name="fiscal_urssaf_montant" defaultValue={org?.fiscal_urssaf_montant ?? ""} placeholder="0" className={inputClass} />
            </div>
          </div>
          <p className="mt-4 text-[10px] text-slate-400">
            Laisse une échéance vide pour utiliser l&apos;échéance standard française calculée automatiquement.
          </p>
          <div className="mt-6 flex justify-end">
            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>

      {/* Équipe */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Équipe
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

    </section>
  );
}
