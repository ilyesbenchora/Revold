import { ParametresTabs } from "@/components/parametres-tabs";

const ALERT_RULES = [
  { id: "deals_stagnant", label: "Deals stagnants", description: "Aucune activité commerciale depuis X jours", defaultThreshold: "7 jours", category: "commercial" },
  { id: "deals_no_owner", label: "Deals sans owner", description: "Plus de X% des deals ouverts n'ont pas de commercial assigné", defaultThreshold: "10%", category: "commercial" },
  { id: "won_no_invoice", label: "Won sans facture", description: "Deal Closed Won sans facture associée dans Stripe/Pennylane après X jours", defaultThreshold: "7 jours", category: "cross_source" },
  { id: "payment_failed", label: "Échec de paiement", description: "Tout échec de paiement Stripe sur un compte Tier 1", defaultThreshold: "Immédiat", category: "billing" },
  { id: "churn_risk", label: "Risque de churn", description: "Compte avec >X tickets ouverts à 30j du renouvellement", defaultThreshold: "3 tickets", category: "support" },
  { id: "data_quality", label: "Qualité de la donnée", description: "Plus de X% de contacts orphelins (sans entreprise)", defaultThreshold: "20%", category: "data" },
  { id: "low_adoption", label: "Adoption faible", description: "Outil métier connecté mais utilisé par moins de X commerciaux", defaultThreshold: "2 users", category: "adoption" },
  { id: "forecast_gap", label: "Écart forecast vs réalisé", description: "Écart > X% entre le pipeline HubSpot et le MRR Stripe sur le dernier mois", defaultThreshold: "15%", category: "cross_source" },
];

const CHANNELS = [
  { id: "in_app", label: "In-app", description: "Cloche du header + page Alertes", enabled: true, available: true },
  { id: "email", label: "Email", description: "Digest quotidien par email", enabled: false, available: true },
  { id: "slack", label: "Slack", description: "Webhook vers un canal Slack dédié", enabled: false, available: false },
  { id: "teams", label: "Microsoft Teams", description: "Webhook vers un canal Teams", enabled: false, available: false },
  { id: "webhook", label: "Webhook custom", description: "POST JSON vers une URL HTTPS", enabled: false, available: false },
];

const CATEGORY_BADGE: Record<string, string> = {
  commercial: "bg-blue-50 text-blue-700",
  billing: "bg-emerald-50 text-emerald-700",
  support: "bg-fuchsia-50 text-fuchsia-700",
  data: "bg-amber-50 text-amber-700",
  adoption: "bg-violet-50 text-violet-700",
  cross_source: "bg-gradient-to-r from-fuchsia-50 to-indigo-50 text-indigo-700",
};

const CATEGORY_LABEL: Record<string, string> = {
  commercial: "Commercial",
  billing: "Facturation",
  support: "Support",
  data: "Data",
  adoption: "Adoption",
  cross_source: "Cross-source",
};

export default function ParametresNotificationsPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Configuration des règles d&apos;alerte et des canaux de notification.
        </p>
      </header>

      <ParametresTabs />

      {/* Channels */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Canaux de diffusion
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CHANNELS.map((c) => (
            <article key={c.id} className="card flex items-start justify-between gap-4 p-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{c.label}</h3>
                  {!c.available && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Bientôt
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{c.description}</p>
              </div>
              <label className="relative inline-flex shrink-0 cursor-not-allowed items-center">
                <input type="checkbox" className="peer sr-only" defaultChecked={c.enabled} disabled />
                <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
              </label>
            </article>
          ))}
        </div>
      </div>

      {/* Alert rules */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Règles d&apos;alerte
        </h2>
        <p className="text-sm text-slate-500">
          Seuils de déclenchement pour les alertes générées automatiquement par Revold.
          Les alertes apparaissent dans la cloche du header et la page Alertes.
        </p>
        <div className="space-y-2">
          {ALERT_RULES.map((rule) => (
            <article key={rule.id} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-slate-900">{rule.label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_BADGE[rule.category]}`}>
                      {CATEGORY_LABEL[rule.category]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="text"
                    defaultValue={rule.defaultThreshold}
                    disabled
                    className="w-24 rounded-lg border border-card-border bg-slate-50 px-2 py-1 text-center text-xs text-slate-700"
                  />
                  <label className="relative inline-flex cursor-not-allowed items-center">
                    <input type="checkbox" className="peer sr-only" defaultChecked disabled />
                    <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                  </label>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Digest schedule */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Planification des digests
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Digest quotidien</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>08:00 (matin)</option>
                <option>12:00 (midi)</option>
                <option>18:00 (fin de journée)</option>
                <option>Désactivé</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Digest hebdomadaire</label>
              <select disabled className="mt-1 w-full rounded-lg border border-card-border bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <option>Lundi 08:00</option>
                <option>Vendredi 17:00</option>
                <option>Désactivé</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
