export const dynamic = "force-dynamic";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import Link from "next/link";
import { InsightLockedBlock } from "@/components/insight-locked-block";

export default async function DashboardOverviewPage() {
  const orgId = await getOrgId();
  const supabase = await createSupabaseServerClient();

  const [snapshot, { data: integrations }] = await Promise.all([
    getHubspotSnapshot(),
    supabase
      .from("integrations")
      .select("provider, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true),
  ]);

  const contactCount = snapshot.totalContacts;
  const dealCount = snapshot.totalDeals;
  const openDealCount = snapshot.openDeals;
  const wonAmount = snapshot.wonAmount;
  const activeIntegrations = (integrations ?? []).length;

  // ── Cards des sections principales — actionables, sans badge score ──
  const sections = [
    {
      label: "Audit",
      description: "Diagnostiquez la santé de votre CRM : données, process, performances, adoption.",
      href: "/dashboard/audit",
      cta: "Lancer l'audit",
      gradient: "from-blue-500 to-indigo-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      label: "Coaching IA",
      description: "Transformez vos données en plans d'action concrets pour vos équipes.",
      href: "/dashboard/insights-ia",
      cta: "Voir les coachings",
      gradient: "from-fuchsia-500 to-pink-500",
      ai: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
          <path d="M10 21v1a2 2 0 0 0 4 0v-1" />
        </svg>
      ),
    },
    {
      label: "Rapports",
      description: "Construisez des rapports sur mesure pour piloter ce qui compte vraiment.",
      href: "/dashboard/rapports",
      cta: "Créer un rapport",
      gradient: "from-emerald-500 to-teal-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="16" y2="17" />
        </svg>
      ),
    },
    {
      label: "Simulations IA",
      description: "Mesurez l'impact d'objectifs ambitieux et activez des alertes intelligentes.",
      href: "/dashboard/alertes",
      cta: "Lancer une simulation",
      gradient: "from-amber-500 to-orange-500",
      ai: true,
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      label: "Intégration",
      description: "Connectez votre CRM, votre facturation, votre téléphonie et votre service client.",
      href: "/dashboard/integration",
      cta: activeIntegrations > 0 ? "Gérer les intégrations" : "Connecter mes outils",
      gradient: "from-violet-500 to-fuchsia-500",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
    },
  ];

  const isEmpty = (contactCount ?? 0) === 0 && (dealCount ?? 0) === 0;

  return (
    <section className="space-y-8">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Vue d&apos;ensemble</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isEmpty
            ? "Bienvenue sur Revold. Connectez votre stack revenue pour démarrer."
            : "Synthèse globale de votre intelligence revenue."}
        </p>
      </header>

      {/* Hero — KPIs essentiels */}
      <div className="card overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-accent via-indigo-500 to-fuchsia-500" />
        <div className="p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Contacts CRM</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{(contactCount ?? 0).toLocaleString("fr-FR")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Deals ouverts</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{(openDealCount ?? 0).toLocaleString("fr-FR")}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">CA Closed Won</p>
              <p className="mt-1 text-2xl font-bold text-emerald-600 tabular-nums">
                {wonAmount > 0 ? `${Math.round(wonAmount / 1000).toLocaleString("fr-FR")}K€` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Outils connectés</p>
              <p className="mt-1 text-2xl font-bold text-accent tabular-nums">{activeIntegrations}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total deals</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{(dealCount ?? 0).toLocaleString("fr-FR")}</p>
            </div>
          </div>
          {isEmpty && (
            <div className="mt-5 flex items-center gap-2 rounded-lg bg-amber-50/60 border border-amber-100 px-4 py-2.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600 shrink-0">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-xs text-amber-800">
                Aucune donnée pour l&apos;instant. <Link href="/dashboard/integration" className="font-medium underline hover:no-underline">Connectez votre CRM HubSpot</Link> pour démarrer.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Cards d'accès aux sections principales — sans badge score, force de proposition */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="card group relative overflow-hidden p-5 transition hover:shadow-md hover:border-accent/30"
          >
            {/* Halo gradient au hover */}
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${s.gradient}`} />

            <div className="flex items-start gap-3">
              <div className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${s.gradient} text-white shadow-sm`}>
                {s.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-accent transition">
                    {s.label}
                  </h3>
                  {s.ai && (
                    <span className="rounded-full bg-gradient-to-r from-amber-100 to-fuchsia-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-fuchsia-700">
                      IA
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{s.description}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs font-medium text-accent group-hover:underline">
                {s.cta} →
              </span>
            </div>
          </Link>
        ))}
      </div>

      {/* AI Insight — Locked / Upgrade required */}
      <InsightLockedBlock
        previewTitle="Analyse stratégique de votre pipeline RevOps"
        previewBody="L'IA Revold analyse en continu vos données CRM pour identifier les opportunités cachées, les risques émergents et les actions prioritaires à mener."
      />
    </section>
  );
}
