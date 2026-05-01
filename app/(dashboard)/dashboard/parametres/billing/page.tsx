export const dynamic = "force-dynamic";

import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/billing/plans";
import { BillingActions } from "@/components/billing-actions";
import { ParametresTabs } from "@/components/parametres-tabs";

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  trialing: { label: "Essai 14 jours", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  active: { label: "Actif", tone: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  past_due: { label: "Paiement en échec", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  canceled: { label: "Annulé", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  incomplete: { label: "Incomplet", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  incomplete_expired: { label: "Expiré", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  unpaid: { label: "Impayé", tone: "bg-rose-50 text-rose-800 border-rose-200" },
  paused: { label: "En pause", tone: "bg-slate-50 text-slate-700 border-slate-200" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const orgId = await getOrgId();
  if (!orgId) {
    return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;
  }
  const { status: searchStatus } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: sub } = await supabase
    .from("org_subscriptions")
    .select("plan, billing_period, status, trial_end, current_period_end, cancel_at_period_end")
    .eq("organization_id", orgId)
    .maybeSingle();

  const plan = sub?.plan as keyof typeof PLANS | undefined;
  const planObj = plan ? PLANS[plan] : null;
  const status = (sub?.status as string | undefined) ?? null;
  const statusMeta = status ? STATUS_LABEL[status] : null;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gérez votre abonnement Revold, votre méthode de paiement et vos factures.
        </p>
      </header>

      <ParametresTabs />

      {searchStatus === "success" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✓ Souscription confirmée. Votre essai 14 jours commence dès maintenant.
        </div>
      )}
      {searchStatus === "cancel" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Souscription annulée. Vous pouvez relancer à tout moment ci-dessous.
        </div>
      )}

      {sub && planObj ? (
        <div className="card overflow-hidden">
          <div className="border-b border-card-border bg-slate-50 px-6 py-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plan actif</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{planObj.name}</p>
              </div>
              {statusMeta && (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusMeta.tone}`}>
                  {statusMeta.label}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">Tarif</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {sub.billing_period === "yearly"
                  ? `${planObj.yearlyPrice} € / an`
                  : `${planObj.monthlyPrice} € / mois`}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">
                {status === "trialing" ? "Fin de l'essai" : "Prochaine échéance"}
              </p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {formatDate(status === "trialing" ? sub.trial_end : sub.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Renouvellement</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {sub.cancel_at_period_end ? "Annulé en fin de période" : "Automatique"}
              </p>
            </div>
          </div>
          <div className="border-t border-card-border bg-slate-50 px-6 py-4">
            <BillingActions hasSubscription={true} />
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <p className="text-sm font-semibold text-slate-900">Aucun abonnement actif</p>
          <p className="mt-2 text-sm text-slate-500">
            Souscrivez à un plan Revold avec 14 jours d&apos;essai gratuit, sans engagement.
          </p>
          <div className="mt-6">
            <BillingActions hasSubscription={false} />
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="border-b border-card-border bg-slate-50 px-6 py-4">
          <p className="text-sm font-semibold text-slate-900">Plans disponibles</p>
        </div>
        <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          {Object.values(PLANS).map((p) => {
            const isCurrent = plan === p.key;
            return (
              <div
                key={p.key}
                className={`rounded-xl border p-5 ${
                  isCurrent ? "border-accent bg-accent/5" : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{p.name}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {p.monthlyPrice} <span className="text-sm font-normal text-slate-500">€/mois</span>
                </p>
                <p className="mt-2 text-xs text-slate-500">{p.description}</p>
                <p className="mt-3 text-[11px] text-slate-500">
                  {p.maxConnectors === null ? "Connecteurs illimités" : `Jusqu'à ${p.maxConnectors} connecteur${p.maxConnectors > 1 ? "s" : ""}`}
                </p>
                {isCurrent && (
                  <p className="mt-3 text-[11px] font-semibold text-accent">Plan actif</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
