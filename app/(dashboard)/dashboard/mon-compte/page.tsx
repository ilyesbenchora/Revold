export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/cached";
import { LocaleSettings } from "@/components/locale-settings";
import { AccountPhoneForm } from "@/components/account-phone-form";
import { SettingsEditLock } from "@/components/settings-edit-lock";
import { MonCompteTabs } from "@/components/mon-compte-tabs";

export default async function MonComptePage() {
  const user = await getAuthUser();
  if (!user) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }

  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name, slug, plan)")
    .eq("id", user.id)
    .single();

  const org = profile?.organizations as unknown as { name: string; slug: string; plan: string } | null;
  const fullName = profile?.full_name ?? "";
  const [firstName = "", ...rest] = fullName.split(" ");
  const lastName = rest.join(" ");
  const phone = (user.user_metadata?.phone as string) || "";

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon compte</h1>
        <p className="mt-1 text-sm text-slate-500">Gérez vos informations personnelles, vos notifications et votre abonnement.</p>
      </header>

      <MonCompteTabs />

      {/* Informations personnelles */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          Informations personnelles
        </h2>
        <SettingsEditLock fallbackCta label="✎ Modifier mes informations">
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Prénom</label>
              <input type="text" defaultValue={firstName} placeholder="Prénom"
                className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Nom</label>
              <input type="text" defaultValue={lastName} placeholder="Nom"
                className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Email</label>
              <input type="email" defaultValue={user.email ?? ""} disabled
                className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-600" />
            </div>
            <AccountPhoneForm initialPhone={phone} />
            <div>
              <label className="text-xs font-medium text-slate-500">Nom de l&apos;entreprise</label>
              <input type="text" defaultValue={org?.name ?? ""} placeholder="Mon entreprise"
                className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Mot de passe</label>
              <button className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                Modifier le mot de passe
              </button>
            </div>
          </div>
        </div>
        </SettingsEditLock>
      </div>

      {/* Langue & format des dates : appliqué dynamiquement aux dates/nombres */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">Langue &amp; format des dates</h2>
        <SettingsEditLock fallbackCta label="✎ Modifier">
          <LocaleSettings />
        </SettingsEditLock>
      </div>

      {/* La souscription et les plans vivent dans l'onglet Facturation. */}
    </section>
  );
}
