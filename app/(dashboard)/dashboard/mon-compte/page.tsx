export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/cached";

const PRICING = [
  {
    id: "starter",
    name: "Starter",
    price: "79",
    desc: "Pour les équipes qui démarrent le RevOps",
    features: [
      "Weekly revenue pulse",
      "8 métriques essentielles",
      "Dashboard pipeline",
      "Alertes email",
      "1 portail HubSpot",
    ],
    cta: "Choisir Starter",
    featured: false,
  },
  {
    id: "growth",
    name: "Growth",
    price: "249",
    desc: "Pour les équipes qui scalent",
    features: [
      "Tout Starter inclus",
      "80+ métriques RevOps",
      "Diagnostic mensuel",
      "Recommandations IA",
      "Anomaly detection",
      "3 portails HubSpot",
    ],
    cta: "Choisir Growth",
    featured: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "699",
    desc: "Pour les revenue teams ambitieuses",
    features: [
      "Tout Growth inclus",
      "Rapports stratégiques trimestriels",
      "Simulations what-if",
      "Scorecards custom",
      "Advisor dédié",
      "Portails illimités",
    ],
    cta: "Nous contacter",
    featured: false,
  },
];

const planLabels: Record<string, string> = {
  trial: "Essai gratuit",
  starter: "Starter",
  growth: "Growth",
  scale: "Scale",
  enterprise: "Enterprise",
};

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
  const currentPlan = (org?.plan || "trial").toLowerCase();
  const phone = (user.user_metadata?.phone as string) || "";

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon compte</h1>
        <p className="mt-1 text-sm text-slate-500">Gérez vos informations personnelles et votre abonnement.</p>
      </header>

      {/* Informations personnelles */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Informations personnelles
        </h2>
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
            <div>
              <label className="text-xs font-medium text-slate-500">Téléphone</label>
              <input type="tel" defaultValue={phone} placeholder="+33 6 00 00 00 00"
                className="mt-1 w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none" />
            </div>
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
      </div>

      {/* Souscription actuelle */}
      <div id="subscription" className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Souscription actuelle
        </h2>
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Plan actif</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{planLabels[currentPlan] ?? currentPlan}</p>
              <p className="mt-1 text-sm text-slate-500">Vous bénéficiez de l&apos;ensemble des fonctionnalités du plan {planLabels[currentPlan] ?? currentPlan}.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">Actif</span>
          </div>
        </div>
      </div>

      {/* Plans disponibles */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
          Passer à un plan supérieur
        </h2>
        <p className="text-sm text-slate-500">Débloquez plus de fonctionnalités RevOps et l&apos;intégralité des insights IA.</p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PRICING.map((p) => {
            const isCurrent = p.id === currentPlan;
            const isUpgrade = !isCurrent;
            return (
              <div key={p.id}
                className={`relative rounded-2xl border p-6 ${
                  p.featured ? "border-2 border-accent bg-indigo-50/30" : "border-card-border bg-white"
                }`}
              >
                {p.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-white">
                    Populaire
                  </div>
                )}
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="mt-1 text-xs text-slate-500">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{p.price}€</span>
                  <span className="text-sm text-slate-500"> / mois</span>
                </div>
                {isCurrent ? (
                  <button disabled className="mt-5 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                    Plan actuel
                  </button>
                ) : (
                  <button
                    className="mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                    style={{
                      background: isUpgrade
                        ? "linear-gradient(135deg, #f59e0b 0%, #d97706 35%, #b45309 70%, #f59e0b 100%)"
                        : "#6366f1",
                    }}
                  >
                    {p.cta}
                  </button>
                )}
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-slate-700">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-slate-400">
          14 jours d&apos;essai gratuit. Sans carte bancaire. Annulable à tout moment.
        </p>
      </div>
    </section>
  );
}
