export const dynamic = "force-dynamic";
export const maxDuration = 300;

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId, getHubspotSnapshot } from "@/lib/supabase/cached";
import { getBarColor } from "@/lib/score-utils";
import { getHubSpotToken } from "@/lib/integrations/get-hubspot-token";
import { getConnectedTools } from "@/lib/integrations/connected-tools";
import { BrandLogo } from "@/components/brand-logo";
import { CONNECTABLE_TOOLS } from "@/lib/integrations/connect-catalog";
import { fetchStripeLiveCounts } from "@/lib/integrations/sources/stripe";
import { BlockHeaderIcon } from "@/components/ventes-ui";
import Link from "next/link";

type ToolEntityCount = {
  label: string;
  count: number;
  enrichmentPct?: number;
  enrichmentLabel?: string;
};

type ToolHub = {
  key: string;
  label: string;
  domain: string;
  icon: string;
  category: string;
  entities: ToolEntityCount[];
  /** Champs / hubs critiques manquants (low enrichment ou compteur à 0). */
  gaps: Array<{ entity: string; field: string; pct: number; severity: "critical" | "warning" }>;
};

async function countCanonicalForProvider(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  orgId: string,
  provider: string,
  entityType: string,
): Promise<number> {
  try {
    const { count } = await supabase
      .from("source_links")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .eq("entity_type", entityType);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export default async function DonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const snapshot = await getHubspotSnapshot();
  const hubspotToken = await getHubSpotToken(supabase, orgId);

  // ── Tout depuis HubSpot (snapshot) ──
  // Pour les "with X" on dérive depuis les "no X" du snapshot (total - noX)
  const contactsTotal = snapshot.totalContacts;
  const contactsPhone = Math.max(0, contactsTotal - snapshot.contactsNoPhone);
  const contactsCompany = Math.max(0, contactsTotal - snapshot.orphansCount);
  const contactsTitle = Math.max(0, contactsTotal - snapshot.contactsNoTitle);

  const companiesTotal = snapshot.totalCompanies;
  const companiesDomain = Math.max(0, companiesTotal - snapshot.companiesNoDomain);
  const companiesIndustry = Math.max(0, companiesTotal - snapshot.companiesNoIndustry);
  const companiesRevenue = Math.max(0, companiesTotal - snapshot.companiesNoRevenue);

  const dealsTotal = snapshot.totalDeals;
  const dealsAmount = Math.max(0, dealsTotal - snapshot.dealsNoAmount);
  const dealsCloseDate = Math.max(0, dealsTotal - snapshot.dealsNoCloseDate);

  // dealsWithOwner non dans snapshot — fetch direct rapide
  let dealsOwner = 0;
  if (hubspotToken) {
    try {
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/deals/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${hubspotToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: "hubspot_owner_id", operator: "HAS_PROPERTY" }] }],
          limit: 1,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        dealsOwner = d.total ?? 0;
      }
    } catch {}
  }

  const pct = (filled: number, t: number) => (t > 0 ? Math.round((filled / t) * 100) : 0);

  // ── Hubs synchronisés : HubSpot + outils tiers connectés à Revold ──
  const connectedTools = await getConnectedTools(supabase, orgId);
  const hubs: ToolHub[] = [];

  // HubSpot hub : on l'affiche dès que le snapshot est OK ou qu'on a au moins
  // une métrique HubSpot non nulle. NE PAS dépendre uniquement de hubspotToken
  // (qui peut renvoyer null si le refresh échoue, alors que le snapshot est
  // déjà mis en cache request-scope plus tôt — c'est ce qui faisait
  // disparaître la carte HubSpot pendant que la page Settings continuait à
  // afficher les données live).
  const hubspotConnected =
    snapshot.status === "ok" ||
    (snapshot.totalContacts + snapshot.totalCompanies + snapshot.totalDeals) > 0;
  if (hubspotConnected) {
    const hsGaps: ToolHub["gaps"] = [];
    const phonePct = pct(contactsPhone, contactsTotal);
    const companyPct = pct(contactsCompany, contactsTotal);
    const titlePct = pct(contactsTitle, contactsTotal);
    const domainPct = pct(companiesDomain, companiesTotal);
    const industryPct = pct(companiesIndustry, companiesTotal);
    const revenuePct = pct(companiesRevenue, companiesTotal);
    const amountPct = pct(dealsAmount, dealsTotal);
    const closeDatePct = pct(dealsCloseDate, dealsTotal);
    const ownerPct = pct(dealsOwner, dealsTotal);

    if (contactsTotal > 0 && phonePct < 50) hsGaps.push({ entity: "Contacts", field: "Téléphone", pct: phonePct, severity: phonePct < 20 ? "critical" : "warning" });
    if (contactsTotal > 0 && companyPct < 70) hsGaps.push({ entity: "Contacts", field: "Entreprise liée", pct: companyPct, severity: companyPct < 40 ? "critical" : "warning" });
    if (contactsTotal > 0 && titlePct < 50) hsGaps.push({ entity: "Contacts", field: "Poste", pct: titlePct, severity: titlePct < 20 ? "critical" : "warning" });
    if (companiesTotal > 0 && domainPct < 70) hsGaps.push({ entity: "Entreprises", field: "Domaine", pct: domainPct, severity: domainPct < 40 ? "critical" : "warning" });
    if (companiesTotal > 0 && industryPct < 50) hsGaps.push({ entity: "Entreprises", field: "Secteur", pct: industryPct, severity: industryPct < 20 ? "critical" : "warning" });
    if (companiesTotal > 0 && revenuePct < 30) hsGaps.push({ entity: "Entreprises", field: "CA", pct: revenuePct, severity: revenuePct < 10 ? "critical" : "warning" });
    if (dealsTotal > 0 && amountPct < 80) hsGaps.push({ entity: "Deals", field: "Montant", pct: amountPct, severity: amountPct < 50 ? "critical" : "warning" });
    if (dealsTotal > 0 && closeDatePct < 80) hsGaps.push({ entity: "Deals", field: "Date closing", pct: closeDatePct, severity: closeDatePct < 50 ? "critical" : "warning" });
    if (dealsTotal > 0 && ownerPct < 80) hsGaps.push({ entity: "Deals", field: "Propriétaire", pct: ownerPct, severity: ownerPct < 50 ? "critical" : "warning" });

    // Helper qui transforme un statut diagnostic en label utilisateur
    const diag = snapshot.kpiDiagnostics ?? {};
    const labelFromDiag = (key: string, fallback?: string): string | undefined => {
      const d = diag[key];
      if (!d || d.status === "ok") return fallback;
      if (d.status === "no_scope") return "Scope OAuth manquant";
      if (d.status === "addon_missing") return "Hub HubSpot non activé";
      if (d.status === "bad_property") return "Propriété inexistante";
      if (d.status === "endpoint_error") return `Erreur HubSpot (${d.httpCode ?? "?"})`;
      if (d.status === "network_error") return "Erreur réseau";
      return fallback;
    };

    hubs.push({
      key: "hubspot",
      label: "HubSpot",
      domain: "hubspot.com",
      icon: "🟧",
      category: "CRM",
      entities: [
        { label: "Contacts", count: contactsTotal, enrichmentPct: Math.round((phonePct + companyPct + titlePct) / 3), enrichmentLabel: labelFromDiag("totalContacts", "champs clés") },
        { label: "Entreprises", count: companiesTotal, enrichmentPct: Math.round((domainPct + industryPct + revenuePct) / 3), enrichmentLabel: labelFromDiag("totalCompanies", "champs clés") },
        { label: "Deals", count: dealsTotal, enrichmentPct: Math.round((amountPct + closeDatePct + ownerPct) / 3), enrichmentLabel: labelFromDiag("totalDeals", "champs clés") },
        { label: "Tickets", count: snapshot.totalTickets, enrichmentLabel: labelFromDiag("tickets", snapshot.totalTickets === 0 ? "Service Hub désactivé ou sans tickets" : undefined) },
        { label: "Conversations", count: snapshot.totalConversations, enrichmentLabel: labelFromDiag("conversations") },
        { label: "Quotes", count: snapshot.totalQuotes, enrichmentLabel: labelFromDiag("quotes") },
        { label: "Forms", count: snapshot.formsCount, enrichmentLabel: labelFromDiag("forms") },
        { label: "Workflows", count: snapshot.workflowsCount, enrichmentLabel: snapshot.workflowsActiveCount > 0 ? `${snapshot.workflowsActiveCount} actifs` : labelFromDiag("workflows") },
        { label: "Listes", count: snapshot.listsCount, enrichmentLabel: labelFromDiag("lists") },
        { label: "Custom Objects", count: snapshot.customObjectsCount, enrichmentLabel: labelFromDiag("custom_objects") },
      ].filter((e) => e.count > 0 || ["Contacts", "Entreprises", "Deals", "Tickets"].includes(e.label) || e.enrichmentLabel), // garde aussi les 0 avec un label diag
      gaps: hsGaps,
    });
  }

  // Stripe (et autres outils non-CRM) : entités synchronisées via source_links
  for (const tool of connectedTools) {
    if (tool.key === "hubspot") continue; // déjà traité au-dessus
    const def = CONNECTABLE_TOOLS[tool.key];
    if (!def) continue;

    const entities: ToolEntityCount[] = [];
    const gaps: ToolHub["gaps"] = [];

    if (tool.key === "stripe") {
      // 1. On lit d'abord ce qu'on a en local (source_links) — rapide.
      const [stripeContacts, stripeInvoices, stripeSubs] = await Promise.all([
        countCanonicalForProvider(supabase, orgId, "stripe", "contact"),
        countCanonicalForProvider(supabase, orgId, "stripe", "invoice"),
        countCanonicalForProvider(supabase, orgId, "stripe", "subscription"),
      ]);

      // 2. Si la sync n'a rien produit en local (source_links vide) MAIS
      //    qu'on a une clé Stripe valide, on va lire LIVE chez Stripe pour
      //    afficher les vrais volumes — sinon l'utilisateur voit "0 partout"
      //    alors que des données existent réellement dans Stripe.
      let liveCounts: { customers: number; invoices: number; subscriptions: number; truncated: boolean; error?: string } | null = null;
      const localTotal = stripeContacts + stripeInvoices + stripeSubs;
      if (localTotal === 0) {
        try {
          const { data: stripeRow } = await supabase
            .from("integrations")
            .select("access_token")
            .eq("organization_id", orgId)
            .eq("provider", "stripe")
            .eq("is_active", true)
            .maybeSingle();
          if (stripeRow?.access_token) {
            liveCounts = await fetchStripeLiveCounts(stripeRow.access_token as string);
          }
        } catch {}
      }

      // 3. On combine : la valeur live l'emporte sur la valeur locale (0)
      const customersCount = liveCounts ? liveCounts.customers : stripeContacts;
      const invoicesCount = liveCounts ? liveCounts.invoices : stripeInvoices;
      const subsCount = liveCounts ? liveCounts.subscriptions : stripeSubs;

      // Contacts Stripe sans lien HubSpot — gap critique (uniquement si on a
      // synchronisé localement, sinon pas de notion d'orphelin)
      let orphanCount = 0;
      let linkedPct = 0;
      if (stripeContacts > 0) {
        try {
          const { data: links } = await supabase
            .from("source_links")
            .select("internal_id")
            .eq("organization_id", orgId)
            .eq("provider", "stripe")
            .eq("entity_type", "contact")
            .limit(1000);
          const ids = (links ?? []).map((l) => l.internal_id as string);
          for (let i = 0; i < ids.length; i += 200) {
            const chunk = ids.slice(i, i + 200);
            const { count } = await supabase
              .from("contacts")
              .select("id", { count: "exact", head: true })
              .eq("organization_id", orgId)
              .in("id", chunk)
              .is("hubspot_id", null);
            orphanCount += count ?? 0;
          }
        } catch {}
        linkedPct = Math.round(((stripeContacts - orphanCount) / stripeContacts) * 100);
      }

      const liveSuffix = liveCounts ? " (live Stripe)" : "";
      entities.push(
        {
          label: "Customers",
          count: customersCount,
          enrichmentPct: stripeContacts > 0 ? linkedPct : undefined,
          enrichmentLabel: stripeContacts > 0
            ? "liés à HubSpot"
            : liveCounts
              ? "lecture directe Stripe — sync à relancer pour matcher avec HubSpot"
              : undefined,
        },
        { label: "Invoices", count: invoicesCount, enrichmentLabel: liveCounts ? `live Stripe${liveCounts.truncated ? " (≥)" : ""}` : undefined },
        { label: "Subscriptions", count: subsCount, enrichmentLabel: liveCounts ? `live Stripe${liveCounts.truncated ? " (≥)" : ""}` : undefined },
      );

      if (stripeContacts > 0 && linkedPct < 70) {
        gaps.push({
          entity: "Customers",
          field: `${orphanCount} sans contact HubSpot`,
          pct: linkedPct,
          severity: linkedPct < 40 ? "critical" : "warning",
        });
      }
      if (liveCounts?.error) {
        gaps.push({
          entity: "Stripe",
          field: `Erreur API Stripe : ${liveCounts.error.slice(0, 80)}`,
          pct: 0,
          severity: "critical",
        });
      } else if (
        customersCount === 0 &&
        invoicesCount === 0 &&
        subsCount === 0
      ) {
        gaps.push({
          entity: "Stripe",
          field: "Aucune donnée détectée dans Stripe — vérifiez la clé secrète",
          pct: 0,
          severity: "critical",
        });
      } else if (localTotal === 0 && liveCounts) {
        // Live OK mais sync locale jamais lancée → pas un gap critique,
        // juste une suggestion de relancer la sync pour activer les
        // analyses cross-source.
        gaps.push({
          entity: "Sync locale",
          field: `${liveSuffix.trim()} détectée — relancez la sync pour activer les analyses cross-source HubSpot`,
          pct: 0,
          severity: "warning",
        });
      }
    } else {
      // Autres outils : compte générique multi-entités
      const types = ["contact", "company", "invoice", "subscription", "ticket", "deal"];
      for (const t of types) {
        const c = await countCanonicalForProvider(supabase, orgId, tool.key, t);
        if (c > 0) entities.push({ label: t.charAt(0).toUpperCase() + t.slice(1) + "s", count: c });
      }
      if (entities.length === 0) {
        gaps.push({
          entity: tool.label,
          field: "Aucune donnée synchronisée — relancez la sync",
          pct: 0,
          severity: "critical",
        });
      }
    }

    hubs.push({
      key: tool.key,
      label: tool.label,
      domain: def.domain,
      icon: def.icon,
      category: def.category,
      entities,
      gaps,
    });
  }

  const summaries: Array<{
    label: string;
    href: string;
    count: number;
    icon: "users" | "building" | "briefcase";
    tone: "blue" | "violet" | "orange";
    metrics: Array<{ label: string; pct: number }>;
  }> = [
    {
      label: "Contacts",
      href: "/dashboard/donnees/contacts",
      count: contactsTotal,
      icon: "users",
      tone: "blue",
      metrics: [
        { label: "Téléphone", pct: pct(contactsPhone, contactsTotal) },
        { label: "Entreprise liée", pct: pct(contactsCompany, contactsTotal) },
        { label: "Poste", pct: pct(contactsTitle, contactsTotal) },
      ],
    },
    {
      label: "Entreprises",
      href: "/dashboard/donnees/entreprises",
      count: companiesTotal,
      icon: "building",
      tone: "violet",
      metrics: [
        { label: "Domaine", pct: pct(companiesDomain, companiesTotal) },
        { label: "Secteur", pct: pct(companiesIndustry, companiesTotal) },
        { label: "CA", pct: pct(companiesRevenue, companiesTotal) },
      ],
    },
    {
      label: "Transactions",
      href: "/dashboard/donnees/transactions",
      count: dealsTotal,
      icon: "briefcase",
      tone: "orange",
      metrics: [
        { label: "Montant", pct: pct(dealsAmount, dealsTotal) },
        { label: "Date closing", pct: pct(dealsCloseDate, dealsTotal) },
        { label: "Propriétaire", pct: pct(dealsOwner, dealsTotal) },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── BANDEAU DIAGNOSTIC SNAPSHOT (si erreur) ── */}
      {snapshot.status === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-900">⚠ Erreur de récupération des données HubSpot</p>
          <p className="mt-1 text-xs text-rose-800">
            Le snapshot n&apos;a pas pu être chargé : {snapshot.error ?? "erreur inconnue"}.
            Les compteurs HubSpot sont à 0 par défaut. Vérifiez la connexion HubSpot dans
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations</Link>.
          </p>
        </div>
      )}
      {snapshot.status === "no-token" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">🔌 HubSpot non connecté</p>
          <p className="mt-1 text-xs text-amber-800">
            Connectez votre portail HubSpot via OAuth pour alimenter cette page.
            <Link href="/dashboard/integration" className="ml-1 font-semibold underline">Intégrations →</Link>
          </p>
        </div>
      )}

      {/* ── HUBS SYNCHRONISÉS (CRM + outils tiers) ── */}
      {hubs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BlockHeaderIcon icon="database" tone="indigo" />
              Hubs synchronisés
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {hubs.length}
              </span>
            </h2>
            <Link
              href="/dashboard/integration"
              className="text-xs font-medium text-accent hover:underline"
            >
              Gérer les intégrations →
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {hubs.map((h) => (
              <article key={h.key} className="card overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-3">
                    <BrandLogo domain={h.domain} alt={h.label} fallback={h.icon} size={36} />
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{h.label}</h3>
                      <p className="text-[11px] text-slate-500 capitalize">{h.category}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    ✓ Connecté
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {h.entities.map((e) => (
                    <li key={e.label} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-slate-700">{e.label}</p>
                        {e.enrichmentLabel && (
                          <p className="text-[10px] text-slate-400">{e.enrichmentLabel}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {e.enrichmentPct != null && e.count > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                              e.enrichmentPct >= 70
                                ? "bg-emerald-100 text-emerald-700"
                                : e.enrichmentPct >= 40
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {e.enrichmentPct}%
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {e.count.toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                {h.gaps.length > 0 && (
                  <div className="border-t border-rose-100 bg-rose-50/40 px-4 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                      ⚠ À enrichir ({h.gaps.length})
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {h.gaps.slice(0, 3).map((g, i) => (
                        <li key={i} className="text-[11px] text-slate-700">
                          <span className="font-medium">{g.entity}</span> — {g.field}{" "}
                          <span className={`font-bold ${g.severity === "critical" ? "text-rose-700" : "text-amber-700"}`}>
                            {g.pct}%
                          </span>
                        </li>
                      ))}
                      {h.gaps.length > 3 && (
                        <li className="text-[10px] text-slate-400">+{h.gaps.length - 3} autres</li>
                      )}
                    </ul>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      )}

      {/* Object summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaries.map((s) => (
          <Link key={s.label} href={s.href} className="card p-5 transition hover:shadow-md group">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BlockHeaderIcon icon={s.icon} tone={s.tone} />
                <span className="text-sm font-semibold text-slate-900 group-hover:text-accent">{s.label}</span>
              </div>
              <span className="text-2xl font-bold text-slate-900 tabular-nums">{s.count.toLocaleString("fr-FR")}</span>
            </div>
            <div className="mt-3 space-y-2">
              {s.metrics.map((m) => (
                <div key={m.label}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">{m.label}</span>
                    <span className={`font-semibold ${m.pct >= 80 ? "text-emerald-600" : m.pct >= 50 ? "text-amber-600" : "text-red-500"}`}>{m.pct} %</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${getBarColor(m.pct)}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-400 group-hover:text-accent">Voir le détail →</p>
          </Link>
        ))}
      </div>

    </div>
  );
}
