export const revalidate = 60;

import type { Metadata } from "next";
import Link from "next/link";
import { SiteNavbar } from "@/components/site-navbar";
import { SiteFooter } from "@/components/site-footer";
import { computePlatformStatus, type SystemHealth } from "@/lib/status/compute";

export const metadata: Metadata = {
  title: "Statut de la plateforme — Revold",
  description:
    "État en temps réel des systèmes Revold : synchronisation des données, calcul des indicateurs, alertes, routines des agents. Transparence totale sur la fraîcheur de vos chiffres.",
};

/**
 * Page statut PUBLIQUE — la transparence comme argument de confiance : Revold
 * vend des chiffres fiables, cette page prouve que les systèmes qui les
 * produisent tournent (alimentée par le monitoring réel des crons, cache 60 s).
 */

const HEALTH_META: Record<SystemHealth, { label: string; dot: string; text: string }> = {
  operational: { label: "Opérationnel", dot: "bg-emerald-400", text: "text-emerald-300" },
  degraded: { label: "Dégradé", dot: "bg-amber-400", text: "text-amber-300" },
  unknown: { label: "Initialisation", dot: "bg-slate-500", text: "text-slate-400" },
};

function relativeFr(iso: string | null): string {
  if (!iso) return "pas encore d'exécution";
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export default async function StatutPage() {
  const status = await computePlatformStatus();
  const overall = HEALTH_META[status.overall];

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -left-40 top-0 h-80 w-80 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-40 top-20 h-80 w-80 rounded-full bg-indigo-600/15 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-6 pb-10 pt-16 text-center md:pt-24">
          <h1 className="text-3xl font-bold tracking-tight text-white md:text-5xl">Statut de la plateforme</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Revold vend des chiffres fiables — voici, en continu, l&apos;état réel des systèmes qui les produisent.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24">
        {/* Bandeau global */}
        <div
          className={`flex items-center gap-3 rounded-2xl border p-5 ${
            status.overall === "operational"
              ? "border-emerald-400/30 bg-emerald-500/10"
              : status.overall === "degraded"
                ? "border-amber-400/30 bg-amber-500/10"
                : "border-white/10 bg-white/[0.03]"
          }`}
        >
          <span className="relative flex h-3.5 w-3.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${overall.dot}`} />
            <span className={`relative inline-flex h-3.5 w-3.5 rounded-full ${overall.dot}`} />
          </span>
          <div>
            <p className={`text-base font-semibold ${overall.text}`}>
              {status.overall === "operational"
                ? "Tous les systèmes sont opérationnels"
                : status.overall === "degraded"
                  ? "Fonctionnement dégradé sur une partie des systèmes"
                  : "Plateforme en cours d'initialisation"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              Vérifié {relativeFr(status.checkedAt)} — actualisation automatique toutes les 60 secondes.
            </p>
          </div>
        </div>

        {/* Systèmes */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {status.systems.map((s, i) => {
            const meta = HEALTH_META[s.status];
            return (
              <div
                key={s.key}
                className={`flex items-start justify-between gap-4 p-5 ${i > 0 ? "border-t border-white/10" : ""}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{s.label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{s.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`inline-flex items-center gap-1.5 text-sm font-medium ${meta.text}`}>
                    <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                    {meta.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {s.status === "unknown" ? "en attente du premier cycle" : `dernier cycle réussi ${relativeFr(s.lastOkAt)}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Engagements */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { t: "Chiffres déterministes", d: "Chaque KPI est recalculé depuis vos données réelles — jamais estimé par l'IA." },
            { t: "Hébergement UE", d: "Données sur PostgreSQL (Supabase) en Union européenne, chiffrées en transit et au repos." },
            { t: "Accès lecture seule", d: "Revold lit vos outils, ne les modifie que sur action validée — accès révocable à tout moment." },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm font-semibold text-white">{b.t}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{b.d}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-500">
          Un doute, un incident ? <Link href="/contact" className="text-slate-300 underline hover:text-white">Contacte-nous</Link> — statut technique brut disponible sur{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5">/api/status</code>.
        </p>
      </section>

      <SiteFooter />
    </div>
  );
}
