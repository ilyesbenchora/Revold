import type { ReactNode } from "react";

/**
 * CAPTURES D'ÉCRAN produit du site marketing — 100 % code, 100 % STATIQUES
 * (aucune animation : crédibilité et stabilité pour les grands comptes).
 * Chaque « shot » reproduit l'interface RÉELLE de l'app (thème clair, cartes
 * blanches, accent indigo, sidebar actuelle) dans un cadre navigateur sombre
 * cohérent avec la DA du site. Remplace les blocs de statistiques génériques :
 * le visiteur voit à quoi l'outil ressemble.
 */

/* ─────────────── Cadre navigateur ─────────────── */

// Cadre épuré : PLUS de bandeau navigateur (pastilles + URL) — la capture
// commence directement sur l'interface. `url` reste dans la signature pour ne
// pas toucher les ~16 appels, mais n'est plus rendue.
export function Browser({ children, className = "" }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-indigo-950/50 ${className}`}>
      <div className="bg-slate-50 text-left">{children}</div>
    </div>
  );
}

/* ─────────────── Primitives UI (thème clair app) ─────────────── */

function Tile({ label, value, delta, tone = "text-slate-900" }: { label: string; value: string; delta?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[9px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-base font-bold tabular-nums ${tone}`}>{value}</p>
      {delta && <p className="mt-0.5 text-[10px] font-medium text-emerald-600">{delta}</p>}
    </div>
  );
}

function LineChart({ tone = "#4f46e5" }: { tone?: string }) {
  const line = "M2,36 L14,31 L26,33 L38,24 L50,26 L62,17 L74,20 L86,10 L98,7";
  return (
    <svg viewBox="0 0 100 42" preserveAspectRatio="none" className="h-full w-full">
      <path d={`${line} L98,42 L2,42 Z`} fill={tone} opacity="0.08" />
      <path d={line} fill="none" stroke={tone} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SourceChip({ children }: { children: ReactNode }) {
  return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">{children}</span>;
}

const SIDEBAR_ITEMS = ["Accueil", "Mon équipe IA", "Performances", "Trésorerie", "Données", "Mes rapports", "Alertes", "Intégrations"];

function Sidebar({ active }: { active: string }) {
  return (
    <div className="hidden w-36 shrink-0 border-r border-slate-200 bg-white px-2 py-3 sm:block">
      <div className="space-y-0.5">
        {SIDEBAR_ITEMS.map((item) => (
          <p key={item} className={`rounded-md px-2 py-1 text-[10px] ${item === active ? "bg-indigo-50 font-semibold text-indigo-700" : "text-slate-500"}`}>
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ─────────────── Shot : Accueil (Mon tableau de bord) ─────────────── */

export function ShotDashboard() {
  return (
    <Browser url="app.revold.ai/dashboard">
      <div className="flex">
        <Sidebar active="Accueil" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Camille, voici ton tableau de bord</p>
          <p className="text-[10px] text-slate-500">Pipeline, facturé, encaissé — réconciliés sur la même page.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="MRR réconcilié" value="84 300 €" delta="+4,2 % vs mois dernier" />
            <Tile label="Intégrations actives" value="5" tone="text-indigo-600" />
            <Tile label="Analyses à traiter" value="12" tone="text-fuchsia-600" />
            <Tile label="Impayés > 30 j" value="41 200 €" tone="text-rose-600" />
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <div className="col-span-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-slate-700">Revenue réconcilié · 6 mois</p>
                <span className="text-[10px] font-bold text-emerald-600">+24 %</span>
              </div>
              <div className="mt-1 flex gap-1">
                <SourceChip>HubSpot</SourceChip>
                <SourceChip>Stripe</SourceChip>
                <SourceChip>Pennylane</SourceChip>
              </div>
              <div className="mt-2 h-16"><LineChart /></div>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold text-slate-700">Mon équipe IA</p>
              <div className="mt-2 space-y-1.5">
                {[
                  { n: "Agent Performance", s: "3 analyses prêtes" },
                  { n: "Agent Trésorerie", s: "2 relances proposées" },
                  { n: "Agent Données", s: "Audit à jour" },
                ].map((a) => (
                  <div key={a.n} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="h-4 w-4 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600" />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-800">{a.n}</p>
                      <p className="truncate text-[9px] text-slate-500">{a.s}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Composite héro (façon Aircall) ─────────────── */

/**
 * Capture composite pour la ligne de flottaison de la home : le dashboard au
 * centre, entouré de cartes features réelles (alerte, agent IA, action
 * exécutée) qui débordent du cadre — statique, sans animation.
 */
export function HeroComposite() {
  return (
    <div className="relative mx-auto max-w-4xl">
      <ShotDashboard />

      {/* Alerte câblée — seuil franchi */}
      <div className="absolute -left-14 top-8 hidden w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl lg:block">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </span>
          <p className="text-[11px] font-semibold text-slate-900">Alerte · Impayés &gt; 45 j</p>
        </div>
        <p className="mt-1.5 text-[10px] text-slate-500">Seuil franchi sur 3 comptes · <span className="font-semibold text-rose-600">41 200 €</span> · via Pennylane</p>
      </div>

      {/* Agent IA — réponse câblée */}
      <div className="absolute -right-16 top-20 hidden w-60 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl lg:block">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 shrink-0 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600" />
          <p className="text-[11px] font-semibold text-slate-900">Agent Trésorerie</p>
        </div>
        <p className="mt-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600">« Quel est mon MRR réconcilié ? »</p>
        <p className="mt-1.5 text-[10px] text-slate-700"><span className="font-bold text-slate-900">84 300 €</span> (+4,2 %) — calculé sur Stripe × Pennylane, rapproché par SIREN.</p>
      </div>

      {/* Action validée, exécutée dans l'outil */}
      <div className="absolute -bottom-6 -left-8 hidden w-64 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl lg:block">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-slate-900">Relancer la facture #4472</p>
          <SourceChip>HubSpot</SourceChip>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">Dupont SAS · 12 400 € · échue depuis 12 j</p>
        <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          Validée → exécutée dans HubSpot
        </p>
      </div>
    </div>
  );
}

/* ─────────────── Shot : Réconciliation CRM × facturation ─────────────── */

export function ShotReconciliation() {
  const rows = [
    { c: "Dupont SAS", siren: "552 100 554", signe: "48 000 €", enc: "36 000 €", ecart: "12 000 €", warn: true },
    { c: "Nexa Conseil", siren: "839 214 776", signe: "27 500 €", enc: "27 500 €", ecart: "0 €", warn: false },
    { c: "Atelier Brio", siren: "512 664 209", signe: "31 200 €", enc: "22 400 €", ecart: "8 800 €", warn: true },
    { c: "Groupe Livio", siren: "798 330 145", signe: "64 000 €", enc: "64 000 €", ecart: "0 €", warn: false },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/tresorerie">
      <div className="flex">
        <Sidebar active="Trésorerie" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Réconciliation signé × encaissé</p>
              <p className="text-[10px] text-slate-500">Entreprises rapprochées par SIREN / N° TVA · HubSpot × Stripe × Pennylane</p>
            </div>
            <span className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-600">20 800 € d&apos;écart révélé</span>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-5 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Entreprise</span><span>SIREN</span><span className="text-right">Signé (CRM)</span><span className="text-right">Encaissé</span><span className="text-right">Écart</span>
            </div>
            {rows.map((r) => (
              <div key={r.c} className="grid grid-cols-5 items-center gap-2 border-b border-slate-100 px-3 py-2 text-[10px] last:border-0">
                <span className="truncate font-semibold text-slate-800">{r.c}</span>
                <span className="font-mono text-slate-500">{r.siren}</span>
                <span className="text-right tabular-nums text-slate-700">{r.signe}</span>
                <span className="text-right tabular-nums text-slate-700">{r.enc}</span>
                <span className={`text-right font-bold tabular-nums ${r.warn ? "text-rose-600" : "text-emerald-600"}`}>{r.ecart}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Mon équipe IA (agent expert) ─────────────── */

export function ShotAgents() {
  return (
    <Browser url="app.revold.ai/dashboard/agents/tresorerie">
      <div className="flex">
        <Sidebar active="Mon équipe IA" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-600" />
            <div>
              <p className="text-sm font-bold text-slate-900">Agent Trésorerie</p>
              <p className="text-[10px] text-slate-500">Sources : Stripe · Pennylane · GoCardless</p>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="ml-auto w-fit max-w-[80%] rounded-xl rounded-br-sm bg-indigo-600 px-3 py-2 text-[11px] text-white">
              Quels clients ont un retard de paiement supérieur à 30 jours ?
            </div>
            <div className="w-fit max-w-[90%] rounded-xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] text-slate-700">
                3 clients dépassent 30 jours de retard, pour <span className="font-bold text-slate-900">41 200 €</span> :
              </p>
              <div className="mt-1.5 space-y-1">
                {[
                  { c: "Dupont SAS", v: "12 400 €", d: "42 j" },
                  { c: "Atelier Brio", v: "8 800 €", d: "38 j" },
                  { c: "Nexa Conseil", v: "20 000 €", d: "31 j" },
                ].map((x) => (
                  <div key={x.c} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[10px]">
                    <span className="font-semibold text-slate-800">{x.c}</span>
                    <span className="tabular-nums text-slate-600">{x.v} · {x.d}</span>
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <SourceChip>via Pennylane</SourceChip>
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">Proposer les relances →</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Alertes câblées ─────────────── */

export function ShotAlertes() {
  const alerts = [
    { n: "Impayés > 45 jours", src: "Pennylane", cur: "41 200 €", seuil: "> 20 000 €", canal: "Slack + Email", state: "Franchie", bad: true },
    { n: "MRR mensuel", src: "Stripe", cur: "84 300 €", seuil: "< 80 000 €", canal: "Email", state: "OK", bad: false },
    { n: "Deals sans activité 21 j", src: "HubSpot", cur: "7 deals", seuil: "> 5 deals", canal: "Slack", state: "Franchie", bad: true },
    { n: "Tickets ouverts > 7 j", src: "Zendesk", cur: "3 tickets", seuil: "> 10 tickets", canal: "Email", state: "OK", bad: false },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/mes-alertes">
      <div className="flex">
        <Sidebar active="Alertes" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Mes alertes</p>
          <p className="text-[10px] text-slate-500">Chaque alerte montre la donnée réellement suivie, sa source et la valeur actuelle calculée.</p>
          <div className="mt-3 space-y-2">
            {alerts.map((a) => (
              <div key={a.n} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${a.bad ? "bg-rose-500" : "bg-emerald-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-800">{a.n}</p>
                  <p className="text-[9px] text-slate-500">Seuil {a.seuil} · {a.canal} · <span className="text-slate-400">via {a.src}</span></p>
                </div>
                <span className="tabular-nums text-[11px] font-bold text-slate-900">{a.cur}</span>
                <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold ${a.bad ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{a.state}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Rapports cross-source ─────────────── */

export function ShotRapports() {
  return (
    <Browser url="app.revold.ai/dashboard/mes-rapports">
      <div className="flex">
        <Sidebar active="Mes rapports" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Récap mensuel · Direction</p>
              <p className="text-[10px] text-slate-500">Généré automatiquement chaque 1er du mois · HubSpot × Stripe × Pennylane</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700">Routine active</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile label="CA encaissé" value="112 400 €" delta="+9 % vs août" />
            <Tile label="Pipeline pondéré" value="248 000 €" />
            <Tile label="DSO" value="43 j" tone="text-amber-600" />
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-700">Acquisition → pipeline → encaissé</p>
              <div className="flex gap-1">
                <SourceChip>HubSpot</SourceChip>
                <SourceChip>Stripe</SourceChip>
              </div>
            </div>
            <div className="mt-2 h-16"><LineChart /></div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Audit qualité des données ─────────────── */

export function ShotAudit() {
  const props = [
    { p: "SIREN / SIRET", v: 92 },
    { p: "N° TVA", v: 84 },
    { p: "Effectifs", v: 71 },
    { p: "Téléphone", v: 58 },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/donnees">
      <div className="flex">
        <Sidebar active="Données" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Audit qualité des données</p>
          <p className="text-[10px] text-slate-500">Complétude, doublons et fiches orphelines — recalculés à chaque synchronisation.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile label="Score de santé" value="87 / 100" delta="+6 pts ce mois" tone="text-emerald-600" />
            <Tile label="Doublons fusionnés" value="34" />
            <Tile label="Fiches enrichies Sirene" value="128" tone="text-indigo-600" />
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold text-slate-700">Complétude par propriété · Entreprises</p>
            <div className="mt-2 space-y-1.5">
              {props.map((x) => (
                <div key={x.p} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[10px] text-slate-500">{x.p}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${x.v >= 80 ? "bg-emerald-500" : x.v >= 65 ? "bg-indigo-500" : "bg-amber-500"}`} style={{ width: `${x.v}%` }} />
                  </div>
                  <span className="w-8 text-right text-[10px] font-semibold tabular-nums text-slate-700">{x.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Trésorerie & échéances ─────────────── */

export function ShotTresorerie() {
  return (
    <Browser url="app.revold.ai/dashboard/tresorerie">
      <div className="flex">
        <Sidebar active="Trésorerie" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Trésorerie</p>
          <p className="text-[10px] text-slate-500">Encaissements réels, projection pondérée et échéances fiscales — sur vos données rapprochées.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Tile label="Encaissé (mois)" value="112 400 €" delta="+9 %" />
            <Tile label="Projection pondérée 90 j" value="248 000 €" tone="text-indigo-600" />
            <Tile label="Impayés" value="41 200 €" tone="text-rose-600" />
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            <div className="col-span-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold text-slate-700">Flux net · 6 mois</p>
              <div className="mt-2 h-14"><LineChart tone="#059669" /></div>
            </div>
            <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-[10px] font-semibold text-slate-700">Échéances fiscales</p>
              <div className="mt-2 space-y-1.5">
                {[
                  { n: "TVA · CA3", d: "15 sept.", v: "18 700 €" },
                  { n: "Acompte IS", d: "15 déc.", v: "9 200 €" },
                ].map((e) => (
                  <div key={e.n} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[10px]">
                    <div>
                      <p className="font-semibold text-slate-800">{e.n}</p>
                      <p className="text-[9px] text-slate-500">{e.d}</p>
                    </div>
                    <span className="font-bold tabular-nums text-slate-700">{e.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Pipeline commercial ─────────────── */

export function ShotPipeline() {
  const stages = [
    { s: "Découverte", v: 92, w: 34 },
    { s: "Qualification", v: 148, w: 55 },
    { s: "Proposition", v: 210, w: 78 },
    { s: "Négociation", v: 124, w: 46 },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/performances/commerciale">
      <div className="flex">
        <Sidebar active="Performances" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Performance commerciale</p>
              <p className="text-[10px] text-slate-500">Pipeline pondéré (montant × probabilité) et deals à risque · via HubSpot</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">Pondéré : 248 000 €</span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="space-y-1.5">
              {stages.map((x) => (
                <div key={x.s} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-[10px] text-slate-500">{x.s}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${x.w}%` }} />
                  </div>
                  <span className="w-14 text-right text-[10px] font-semibold tabular-nums text-slate-700">{x.v} k€</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-[11px]">⚠</span>
            <p className="text-[10px] text-amber-800">
              <span className="font-semibold">Deal « Groupe Livio » (64 000 €) silencieux depuis 23 j</span> — action proposée : créer la tâche de relance dans HubSpot.
            </p>
            <span className="ml-auto shrink-0 rounded-md bg-indigo-600 px-2 py-1 text-[9px] font-semibold text-white">Valider</span>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Intégrations connectées ─────────────── */

export function ShotIntegrations() {
  const tools = [
    { n: "HubSpot", c: "CRM", s: "Synchronisé il y a 12 min" },
    { n: "Stripe", c: "Facturation", s: "Synchronisé il y a 8 min" },
    { n: "Pennylane", c: "Comptabilité", s: "Synchronisé il y a 26 min" },
    { n: "Chargebee", c: "Abonnements", s: "Synchronisé il y a 1 h" },
    { n: "GoCardless", c: "Prélèvements", s: "Synchronisé il y a 2 h" },
    { n: "Sage", c: "Comptabilité", s: "Synchronisé il y a 3 h" },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/integration">
      <div className="flex">
        <Sidebar active="Intégrations" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Mes outils connectés</p>
          <p className="text-[10px] text-slate-500">Lecture seule, OAuth ou clé API, révocable à tout moment.</p>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
            {tools.map((t) => (
              <div key={t.n} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-slate-900">{t.n}</p>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-[9px] text-slate-400">{t.c}</p>
                <p className="mt-1.5 text-[9px] font-medium text-emerald-600">{t.s}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Hiérarchie de comptes ─────────────── */

export function ShotHierarchie() {
  const filiales = [
    { n: "Dupont Lyon SAS", siren: "552 100 554", ca: "48 000 €" },
    { n: "Dupont Paris SARL", siren: "552 100 780", ca: "36 500 €" },
    { n: "Dupont Sud SAS", siren: "552 101 002", ca: "21 200 €" },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/hierarchie">
      <div className="flex">
        <Sidebar active="Données" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Hiérarchie de comptes</p>
              <p className="text-[10px] text-slate-500">Sociétés mères et filiales reliées par le registre officiel — CA consolidé par groupe.</p>
            </div>
            <span className="rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700">Groupe : 105 700 €</span>
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between rounded-lg bg-indigo-50 px-3 py-2">
              <div>
                <p className="text-[11px] font-bold text-indigo-900">Groupe Dupont (holding)</p>
                <p className="font-mono text-[9px] text-indigo-700">SIREN 552 099 871</p>
              </div>
              <span className="rounded-md bg-white px-2 py-0.5 text-[9px] font-semibold text-indigo-700">3 filiales détectées</span>
            </div>
            <div className="mt-2 space-y-1.5 pl-4">
              {filiales.map((f) => (
                <div key={f.n} className="flex items-center gap-2 border-l-2 border-slate-200 pl-3">
                  <div className="flex min-w-0 flex-1 items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-slate-800">{f.n}</p>
                      <p className="font-mono text-[9px] text-slate-500">{f.siren}</p>
                    </div>
                    <span className="tabular-nums text-[10px] font-bold text-slate-700">{f.ca}</span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] text-slate-400">Rattachements proposés par le moteur (registre + raison sociale) — validés par vous avant consolidation.</p>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Objectifs par équipe ─────────────── */

export function ShotObjectifs() {
  const goals = [
    { t: "Sales", n: "Pipeline pondéré · cible 320 k€", cur: "248 000 €", pct: 78, ok: true },
    { t: "Finance", n: "DSO · cible 40 j", cur: "43 j", pct: 62, ok: false },
    { t: "CSM", n: "Rétention · cible 92 %", cur: "94 %", pct: 100, ok: true },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/mes-alertes/objectifs">
      <div className="flex">
        <Sidebar active="Alertes" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Objectifs</p>
          <p className="text-[10px] text-slate-500">Un cap chiffré par équipe, suivi en continu sur les données réconciliées.</p>
          <div className="mt-3 space-y-2">
            {goals.map((g) => (
              <div key={g.t} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold text-slate-800">
                    <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">{g.t}</span>
                    {g.n}
                  </p>
                  <span className={`tabular-nums text-[11px] font-bold ${g.ok ? "text-emerald-600" : "text-amber-600"}`}>{g.cur}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${g.ok ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${g.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Boîte d'actions ─────────────── */

export function ShotActions() {
  return (
    <Browser url="app.revold.ai/dashboard/mes-alertes/actions">
      <div className="flex">
        <Sidebar active="Alertes" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Boîte d&apos;actions</p>
          <p className="text-[10px] text-slate-500">Revold détecte et propose, vous validez, l&apos;action s&apos;exécute dans vos outils.</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-800">Créer une tâche de relance · deal « Groupe Livio »</p>
                <SourceChip>HubSpot</SourceChip>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">64 000 € · sans activité depuis 23 j · owner : S. Martin</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-md bg-indigo-600 px-2.5 py-1 text-[10px] font-semibold text-white">Valider</span>
                <span className="rounded-md border border-slate-200 px-2.5 py-1 text-[10px] text-slate-500">Rejeter</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-800">Envoyer le rappel officiel · facture #4472</p>
                <SourceChip>Stripe</SourceChip>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">Dupont SAS · 12 400 € · échue depuis 12 j</p>
              <p className="mt-2 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                Validée hier · rappel envoyé
              </p>
            </div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Cash récupéré, attribué ─────────────── */

export function ShotCashRecupere() {
  const lignes = [
    { f: "#4472 · Dupont SAS", a: "Rappel Stripe validé le 2 sept.", v: "12 400 €", d: "encaissé le 8 sept." },
    { f: "#4391 · Atelier Brio", a: "Relance validée le 26 août", v: "8 800 €", d: "encaissé le 3 sept." },
    { f: "#4356 · Nexa Conseil", a: "Rappel Stripe validé le 19 août", v: "6 200 €", d: "encaissé le 28 août" },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/mes-alertes/actions">
      <div className="flex">
        <Sidebar active="Alertes" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-900">Cash récupéré</p>
              <p className="text-[10px] text-slate-500">Chaque euro encaissé après une action validée est attribué, ligne par ligne.</p>
            </div>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">27 400 € récupérés ce trimestre</span>
          </div>
          <div className="mt-3 space-y-2">
            {lignes.map((l) => (
              <div key={l.f} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-800">{l.f}</p>
                  <p className="text-[9px] text-slate-500">{l.a} · {l.d}</p>
                </div>
                <span className="tabular-nums text-[11px] font-bold text-emerald-600">+{l.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Connecteur ERP / outil métier sur mesure ─────────────── */

export function ShotSurMesure() {
  return (
    <Browser url="app.revold.ai/dashboard/integration/sur-mesure">
      <div className="flex">
        <Sidebar active="Intégrations" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Outil sur mesure</p>
          <p className="text-[10px] text-slate-500">Connectez votre ERP ou n&apos;importe quel outil métier exposant une API — sans développement.</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold text-slate-900">ERP interne · Production</p>
              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Synchronisé il y a 35 min
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Champs mappés</p>
                <p className="mt-1 text-[10px] text-slate-700">code_client → <span className="font-semibold">ID de rapprochement</span></p>
                <p className="text-[10px] text-slate-700">montant_commande → <span className="font-semibold">CA facturé</span></p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Champs métier agrégeables</p>
                <p className="mt-1 text-[10px] text-slate-700">volume_produit · <span className="text-slate-500">somme</span></p>
                <p className="text-[10px] text-slate-700">taux_rebut · <span className="text-slate-500">moyenne</span></p>
              </div>
            </div>
            <p className="mt-2 text-[9px] text-slate-400">1 240 lignes importées · croisées avec le CRM et la facturation par votre code client.</p>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Templates de tableaux de bord ─────────────── */

export function ShotTemplates() {
  const templates = [
    { n: "Direction", d: "MRR, cash, pipeline", tools: "HubSpot × Stripe" },
    { n: "Sales", d: "Pipeline, closing, cycles", tools: "HubSpot" },
    { n: "Finance", d: "Encaissé, DSO, impayés", tools: "Stripe × Pennylane" },
    { n: "Abonnements", d: "MRR, churn, upgrades", tools: "Chargebee" },
  ];
  return (
    <Browser url="app.revold.ai/dashboard/tableaux-de-bord/templates">
      <div className="flex">
        <Sidebar active="Tableaux de bord" />
        <div className="min-w-0 flex-1 p-4">
          <p className="text-sm font-bold text-slate-900">Templates de tableaux de bord</p>
          <p className="text-[10px] text-slate-500">Des modèles prêts à l&apos;emploi par métier et par outil — activés en un clic sur vos données.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {templates.map((t) => (
              <div key={t.n} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex h-8 items-end gap-1">
                  {[35, 60, 45, 75, 55, 80].map((h, j) => (
                    <span key={j} className="flex-1 rounded-sm bg-indigo-200" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <p className="mt-2 text-[11px] font-bold text-slate-900">{t.n}</p>
                <p className="text-[9px] text-slate-500">{t.d}</p>
                <p className="mt-1 text-[9px] font-medium text-indigo-600">{t.tools}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-center text-[10px] text-slate-500">＋ Ou partez d&apos;une page vierge et construisez le vôtre</p>
        </div>
      </div>
    </Browser>
  );
}

/* ─────────────── Shot : Tableau de bord construit de zéro ─────────────── */

export function ShotBoards() {
  return (
    <Browser url="app.revold.ai/dashboard/tableaux-de-bord/pilotage-q4">
      <div className="flex">
        <Sidebar active="Tableaux de bord" />
        <div className="min-w-0 flex-1 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900">Pilotage Q4</p>
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-600">Visibilité : équipe</span>
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">Partager</span>
            </div>
          </div>
          <div className="mt-1.5 flex gap-1 border-b border-slate-200 pb-1.5">
            {["Vue générale", "Ventes", "Trésorerie", "＋ Onglet"].map((t, i) => (
              <span key={t} className={`rounded-md px-2 py-0.5 text-[9px] font-medium ${i === 0 ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}>{t}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Tile label="MRR" value="84 300 €" delta="+4,2 %" />
            <Tile label="Pipeline pondéré" value="248 000 €" tone="text-indigo-600" />
            <Tile label="Impayés" value="41 200 €" tone="text-rose-600" />
          </div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-700">CA encaissé · par mois</p>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">＋ Ajouter un bloc</span>
            </div>
            <div className="mt-2 h-14"><LineChart /></div>
          </div>
        </div>
      </div>
    </Browser>
  );
}

/** Légende standard sous une capture. */
export function ShotCaption() {
  return <p className="mt-3 text-center text-xs text-slate-500">Interface Revold — données de démonstration.</p>;
}
