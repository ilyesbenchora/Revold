import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, organization_id, organizations(name, slug, plan)")
    .eq("id", user!.id)
    .single();

  const org = profile?.organizations as unknown as { name: string; slug: string; plan: string } | null;

  const { data: stages } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("organization_id", profile?.organization_id)
    .order("position");

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("organization_id", profile?.organization_id)
    .order("created_at");

  // Integrations
  const { data: integrations } = await supabase
    .from("integrations")
    .select("provider, is_active, updated_at")
    .eq("organization_id", profile?.organization_id);

  // Recent sync logs
  const { data: syncLogs } = await supabase
    .from("sync_logs")
    .select("*")
    .eq("organization_id", profile?.organization_id)
    .order("started_at", { ascending: false })
    .limit(5);

  const hubspotConnected = integrations?.some((i) => i.provider === "hubspot" && i.is_active) ?? false;

  const planLabels: Record<string, string> = {
    trial: "Essai gratuit",
    starter: "Starter",
    pro: "Pro",
    enterprise: "Enterprise",
  };

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-600">Configuration de votre organisation et compte.</p>
      </header>

      {/* Organization */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Organisation</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Nom</p>
            <p className="mt-1 text-sm text-slate-900">{org?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Slug</p>
            <p className="mt-1 text-sm text-slate-900">{org?.slug ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Plan</p>
            <span className="mt-1 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              {planLabels[org?.plan ?? ""] ?? org?.plan ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Profile */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Mon profil</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Nom</p>
            <p className="mt-1 text-sm text-slate-900">{profile?.full_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</p>
            <p className="mt-1 text-sm text-slate-900">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Rôle</p>
            <p className="mt-1 text-sm capitalize text-slate-900">{profile?.role ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Étapes du pipeline</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-card-border text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="pb-3 pr-4">Position</th>
                <th className="pb-3 pr-4">Nom</th>
                <th className="pb-3 pr-4">Probabilité</th>
                <th className="pb-3">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {(stages ?? []).map((stage) => (
                <tr key={stage.id}>
                  <td className="py-3 pr-4 text-slate-600">{stage.position}</td>
                  <td className="py-3 pr-4 font-medium text-slate-900">{stage.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{stage.probability}%</td>
                  <td className="py-3">
                    {stage.is_closed_won && (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Gagné</span>
                    )}
                    {stage.is_closed_lost && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Perdu</span>
                    )}
                    {!stage.is_closed_won && !stage.is_closed_lost && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">Ouvert</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Integrations */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Intégrations</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-card-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-lg font-bold text-orange-600">H</div>
              <div>
                <p className="text-sm font-medium text-slate-900">HubSpot</p>
                <p className="text-xs text-slate-500">CRM, deals, contacts, companies</p>
              </div>
            </div>
            {hubspotConnected ? (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Connecté</span>
            ) : (
              <a
                href="/api/integrations/hubspot/auth"
                className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Connecter
              </a>
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-card-border p-4 opacity-50">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600">S</div>
              <div>
                <p className="text-sm font-medium text-slate-900">Salesforce</p>
                <p className="text-xs text-slate-500">CRM, opportunities, leads</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Bientôt</span>
          </div>
        </div>
      </div>

      {/* Sync Logs */}
      {syncLogs && syncLogs.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Historique de synchronisation</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-card-border text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4">Source</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Entités</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-card-border">
                {syncLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 pr-4 capitalize text-slate-900">{log.source}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                        log.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                        log.status === "failed" ? "bg-red-100 text-red-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {log.status === "completed" ? "Terminé" : log.status === "failed" ? "Erreur" : "En cours"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{log.entity_count}</td>
                    <td className="py-3 text-slate-400 text-xs">
                      {new Date(log.started_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Équipe</h2>
        {(!members || members.length === 0) ? (
          <p className="text-sm text-slate-600">Aucun membre.</p>
        ) : (
          <div className="divide-y divide-card-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                  <p className="text-xs capitalize text-slate-500">{member.role}</p>
                </div>
                <span className="text-xs text-slate-400">
                  Rejoint le {new Date(member.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
