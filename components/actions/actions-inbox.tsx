"use client";

import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand-logo";

/**
 * Boîte de réception des ACTIONS (Suivi → Actions) — human-in-the-loop.
 * Les détecteurs Revold (et bientôt les agents) proposent des actions à
 * exécuter DANS les outils ; l'utilisateur valide (exécution réelle, tracée)
 * ou refuse. Rien ne part jamais sans validation.
 */

type ActionItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string | null;
  source: string;
  created_at: string;
  decided_at: string | null;
  result: { ok?: boolean; detail?: string } | null;
  payload?: Record<string, unknown> | null;
  /** true = exécutée automatiquement (famille automatisée par l'utilisateur). */
  auto?: boolean;
  /** Entité de référence (deal/entreprise/contact) pour l'automatisation ciblée. */
  entityRef?: { key: string; label: string } | null;
  entityIncluded?: boolean;
  entityExcluded?: boolean;
};

/** Familles automatisables (miroir du serveur) — les fusions restent manuelles. */
const AUTOMATABLE = new Set(["silent_deal", "overdue_invoice", "link_company", "renewal_deal", "revenue_leakage", "billing_contact"]);

/**
 * Détail concret d'une action : ce qui sera exactement écrit dans l'outil à
 * la validation (lignes clé → valeur) + effet et garanties, par type.
 */
function buildDetail(a: ActionItem): { rows: Array<[string, string]>; effect: string } | null {
  const p = a.payload ?? {};
  const s = (k: string) => (typeof p[k] === "string" && (p[k] as string).trim() ? (p[k] as string) : null);
  const eur = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);

  if (a.type === "hubspot_task") {
    const rows: Array<[string, string]> = [];
    if (s("subject")) rows.push(["Sujet de la tâche", s("subject")!]);
    if (s("body")) rows.push(["Contenu", s("body")!]);
    rows.push(["Échéance", "Sous 2 jours (priorité haute)"]);
    rows.push(["Attribution", "Automatique : propriétaire du deal, sinon de l'entreprise, sinon du contact associé"]);
    const assoc = [s("dealHubspotId") && "le deal concerné", s("companyHubspotId") && "l'entreprise", "le contact rattaché"].filter(Boolean).join(", ");
    rows.push(["Associée à", assoc]);
    // Relance d'impayé : le cycle a des conditions d'arrêt explicites.
    if (a.source === "detector:overdue_invoice") {
      rows.push(["Condition d'arrêt", "Paiement reçu → plus aucune relance (le détecteur ne cible que les restes dus)"]);
      rows.push(["Cadence", "7 jours minimum entre deux relances, 3 relances maximum"]);
      rows.push(["Après 3 relances", "Escalade : tâche de recouvrement humaine, plus aucune relance automatique"]);
    }
    return { rows, effect: "Crée UNE tâche dans HubSpot — aucune donnée existante n'est modifiée. Supprimable à tout moment dans HubSpot." };
  }
  if (a.type === "hubspot_sequence_enroll") {
    const rows: Array<[string, string]> = [
      ["Destinataire", "Le contact associé au deal (résolu à l'exécution)"],
      ["Expéditeur", "Le propriétaire du deal — l'email part de SA boîte connectée, avec sa signature"],
      ["Séquence", s("sequenceName") ?? s("sequenceId") ?? "séquence configurée"],
      ["Suite", "Les étapes de la séquence s'enchaînent automatiquement (relances incluses)"],
      ["Condition d'arrêt", "Réponse du contact → HubSpot le désinscrit automatiquement de la séquence"],
      ["Aussi", "Deal gagné ou perdu → le deal sort du détecteur, plus aucune relance proposée"],
    ];
    return {
      rows,
      effect: "Un email RÉEL part vers le client (pas une tâche). Désinscription possible à tout moment dans HubSpot. Si le deal n'a aucun contact associé, une tâche de relance est créée à la place.",
    };
  }
  if (a.type === "stripe_send_invoice") {
    const rows: Array<[string, string]> = [];
    if (s("stripeInvoiceId")) rows.push(["Facture Stripe", s("stripeInvoiceId")!]);
    rows.push(["Ce qui part", "Le rappel OFFICIEL Stripe (email au client, modèle Stripe)"]);
    rows.push(["Condition d'arrêt", "Paiement reçu → plus aucune relance (le détecteur ne cible que les restes dus)"]);
    rows.push(["Cadence", "7 jours minimum entre deux relances, 3 relances maximum"]);
    rows.push(["Après 3 relances", "Escalade : tâche de recouvrement humaine, plus aucun email automatique"]);
    return { rows, effect: "Le client reçoit l'email de rappel Stripe. La relance est suivie dans « Cash récupéré » — aucune donnée modifiée." };
  }
  if (a.type === "hubspot_merge") {
    const rows: Array<[string, string]> = [
      ["Objet", p.mergeObjectType === "companies" ? "Entreprises" : "Contacts"],
      ["Fiche conservée", `HubSpot #${s("primaryHubspotId") ?? "?"} (ses valeurs gagnent en cas de conflit)`],
      ["Fiche absorbée", `HubSpot #${s("mergeHubspotId") ?? "?"} (activités et associations transférées)`],
    ];
    return { rows, effect: "⚠ Fusion IRRÉVERSIBLE dans HubSpot : les deux fiches deviennent une seule. Le doublon disparaît de Revold à la prochaine synchronisation." };
  }
  if (a.type === "hubspot_company_update") {
    const props = (p.hubspotProperties ?? {}) as Record<string, string>;
    const rows: Array<[string, string]> = Object.entries(props).map(([k, v]) => [`Propriété « ${k} »`, `→ ${v}`]);
    return { rows, effect: "Écrit uniquement ces propriétés (aujourd'hui vides) sur la fiche entreprise HubSpot — rien d'autre n'est touché, modifiable ensuite dans HubSpot." };
  }
  if (a.type === "link_company") {
    return {
      rows: [
        ["Ce qui est repointé", "Factures, abonnements, contacts et deals de la fiche facturation → la fiche CRM"],
        ["Identifiants", "SIREN / SIRET / N° TVA / domaine reportés sur la fiche CRM s'ils y manquent"],
        ["Fiche facturation", "Supprimée de Revold une fois tout repointé (les liens sources suivent)"],
      ],
      effect: "Fusion interne à Revold (rien n'est écrit dans HubSpot ni dans l'outil de facturation). Le CA de ce compte devient attribuable dans tous les rapports croisés.",
    };
  }
  if (a.type === "hubspot_create_deal") {
    const rows: Array<[string, string]> = [];
    if (s("dealName")) rows.push(["Nom du deal", s("dealName")!]);
    if (typeof p.dealAmount === "number") rows.push(["Montant", eur(p.dealAmount as number)]);
    if (s("dealCloseDate")) rows.push(["Date de closing", s("dealCloseDate")!]);
    rows.push(["Pipeline", "Pipeline par défaut HubSpot (déplaçable ensuite)"]);
    rows.push(["Associé à", "L'entreprise du compte"]);
    return { rows, effect: "Crée UN deal dans HubSpot — aucune donnée existante n'est modifiée. Le forecast pondéré l'intègre dès la prochaine synchronisation." };
  }
  if (a.type === "hubspot_deal_update") {
    const rows: Array<[string, string]> = [];
    if (s("dealCloseDate")) rows.push(["Nouvelle date de closing", s("dealCloseDate")!]);
    if (s("dealHubspotId")) rows.push(["Deal ciblé", `HubSpot #${s("dealHubspotId")}`]);
    return {
      rows,
      effect: "Modifie UNIQUEMENT la date de closing du deal dans HubSpot — montant, étape et propriétaire sont inchangés. Le forecast pondéré se recale à la prochaine synchronisation.",
    };
  }
  if (a.type === "hubspot_create_contact") {
    const rows: Array<[string, string]> = [];
    if (s("contactEmail")) rows.push(["Email", s("contactEmail")!]);
    if (s("subject")) rows.push(["Nom", s("subject")!]);
    if (s("companyHubspotId")) rows.push(["Rattaché à", "L'entreprise du compte (fiche CRM)"]);
    return { rows, effect: "Crée UN contact dans HubSpot — si l'email existe déjà, rien n'est créé (message explicite). Débloque le rapprochement « email exact » pour ce compte." };
  }
  return null;
}

const TYPE_META: Record<string, { label: string; domain: string; icon: string; tool: string; toolLabel: string }> = {
  hubspot_task: { label: "Tâche HubSpot", domain: "hubspot.com", icon: "🟧", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_sequence_enroll: { label: "Relance par email (séquence)", domain: "hubspot.com", icon: "✉️", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_merge: { label: "Fusion de doublons", domain: "hubspot.com", icon: "🔀", tool: "hubspot", toolLabel: "HubSpot" },
  // Enrichissement CRM : plus produit par un détecteur (console de la page
  // Enrichissement) — conservé pour l'historique déjà en base.
  hubspot_company_update: { label: "Enrichissement CRM", domain: "hubspot.com", icon: "🪪", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_create_deal: { label: "Deal de renouvellement", domain: "hubspot.com", icon: "🔁", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_create_contact: { label: "Création de contact", domain: "hubspot.com", icon: "👤", tool: "hubspot", toolLabel: "HubSpot" },
  hubspot_deal_update: { label: "Date de closing", domain: "hubspot.com", icon: "📅", tool: "hubspot", toolLabel: "HubSpot" },
  link_company: { label: "Rattachement de fiches", domain: "revold.io", icon: "🔗", tool: "revold", toolLabel: "Revold" },
  stripe_send_invoice: { label: "Rappel Stripe", domain: "stripe.com", icon: "💳", tool: "stripe", toolLabel: "Stripe" },
};

/**
 * Catalogue des actions : chaque famille de détecteur est activable — les
 * familles masquées ne sont ni détectées ni affichées (préférence locale).
 */
export const ACTION_CATALOG: Array<{ key: string; label: string; description: string }> = [
  { key: "silent_deal", label: "Deals silencieux à relancer", description: "Deal ouvert sans contact depuis 21 jours → relance par VRAI email (séquence au nom de l'owner, si licence Sales Pro + séquence choisie dans Paramètres → Intégrations), sinon tâche pour le propriétaire." },
  { key: "overdue_invoice", label: "Impayés à relancer", description: "Facture échue avec reste dû → rappel officiel Stripe ou tâche de relance CRM. Cycle borné : 7 jours entre deux relances, 3 maximum, arrêt immédiat dès réception du paiement, puis escalade en tâche de recouvrement humaine. Alimente « Cash récupéré »." },
  { key: "duplicate_merge", label: "Doublons à fusionner", description: "Contacts (même email) et entreprises (même domaine) en doublon, selon les règles de déduplication activées → fusion HubSpot validée fiche par fiche." },
  { key: "link_company", label: "Fiches facturation à relier au CRM", description: "Entreprise vue côté facturation sans lien CRM alors qu'une fiche correspond (nom/domaine) → rattachement : le CA devient attribuable compte par compte." },
  { key: "renewal_deal", label: "Deals de renouvellement manquants", description: "Abonnement actif se terminant sous 60 jours sans deal ouvert → crée le deal de renouvellement (MRR × 12) : le forecast intègre le récurrent." },
  { key: "revenue_leakage", label: "Écarts signé vs facturé (leakage)", description: "Deal gagné dont les factures couvrent moins de 90 % du montant signé → tâche chiffrée pour l'owner : du cash vendu jamais facturé." },
  { key: "billing_contact", label: "Création de contacts facturation", description: "Email de facturation présent côté Stripe/Pennylane mais absent du CRM → crée le contact rattaché à l'entreprise (débloque la règle « email exact »)." },
];

const HIDDEN_KEY = "revold:actions-hidden";
const PAGESIZE_KEY = "revold:actions-pagesize";
const PAGE_SIZES = [15, 20, 50] as const;

function readHidden(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Noms lisibles des agents qui planifient des actions (« Plus tard »). */
const AGENT_LABELS: Record<string, string> = {
  performance: "Performances",
  "paiement-facturation": "Trésorerie",
  "service-client": "Service client",
  proprietes: "Data & intégrations",
  "coaching-ventes": "Coach Ventes",
  "coaching-marketing": "Coach Marketing",
  "coaching-data": "Coach Data & intégrations",
  "coaching-data-model": "Coach Finance",
};

function sourceLabel(source: string): string {
  if (source === "detector:silent_deal") return "Détecteur · deals silencieux";
  if (source === "detector:overdue_invoice") return "Détecteur · impayés";
  if (source === "detector:duplicate_merge") return "Règles de déduplication";
  if (source === "detector:crm_enrich") return "Détecteur · enrichissement CRM";
  if (source === "detector:link_company") return "Détecteur · rapprochement";
  if (source === "detector:renewal_deal") return "Détecteur · renouvellements";
  if (source === "detector:revenue_leakage") return "Détecteur · revenue leakage";
  if (source === "detector:billing_contact") return "Détecteur · contacts facturation";
  // Action planifiée depuis un chat d'agent (« Plus tard »).
  if (source.startsWith("agent:")) return `Agent · ${AGENT_LABELS[source.slice(6)] ?? source.slice(6)}`;
  return source;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export function ActionsInbox() {
  const [pending, setPending] = useState<ActionItem[] | null>(null);
  const [history, setHistory] = useState<ActionItem[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Filtres : type d'action + outil ("" = tous) — appliqués à la file ET à l'historique.
  const [typeFilter, setTypeFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  // Catalogue : familles de détecteurs masquées (préférence locale).
  const [hidden, setHidden] = useState<string[]>([]);
  const [catalogOpen, setCatalogOpen] = useState(false);
  // Fiche dépliée : détail concret de ce que la validation va écrire.
  const [detailId, setDetailId] = useState<string | null>(null);
  // Familles automatisées par l'utilisateur (réglage serveur, par org) +
  // exceptions par entité (include/exclude par famille).
  const [automated, setAutomated] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, { include: string[]; exclude: string[] }>>({});
  const [autoBusy, setAutoBusy] = useState<string | null>(null);
  // Cadences & conditions de sortie effectives, par famille (serveur).
  const [settings, setSettings] = useState<Record<string, Record<string, number | boolean>>>({});
  // Pagination : 15 (défaut) / 20 / 50 lignes, préférence mémorisée.
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(0);
  // Historique : replié par défaut (la page reste légère) + suppression par ligne.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load(hiddenKeys?: string[]) {
    try {
      const skip = (hiddenKeys ?? readHidden()).join(",");
      const res = await fetch(`/api/actions${skip ? `?skip=${encodeURIComponent(skip)}` : ""}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Chargement impossible");
      setNeedsMigration(Boolean(d.needsMigration));
      setPending(Array.isArray(d.pending) ? d.pending : []);
      setHistory(Array.isArray(d.history) ? d.history : []);
      setAutomated(Array.isArray(d.automated) ? d.automated : []);
      setOverrides(d.overrides && typeof d.overrides === "object" ? d.overrides : {});
      setSettings(d.settings && typeof d.settings === "object" ? d.settings : {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
      setPending([]);
    }
  }

  useEffect(() => {
    setHidden(readHidden());
    try {
      const v = Number(localStorage.getItem(PAGESIZE_KEY));
      if ((PAGE_SIZES as readonly number[]).includes(v)) setPageSize(v);
    } catch {}
    void load();
  }, []);

  function toggleCatalog(key: string) {
    const next = hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key];
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)); } catch {}
    setPage(0);
    void load(next);
  }

  function changePageSize(n: number) {
    setPageSize(n);
    setPage(0);
    try { localStorage.setItem(PAGESIZE_KEY, String(n)); } catch {}
  }

  /** Supprime UNE ligne d'historique (les actions en attente ne sont pas supprimables). */
  async function deleteHistoryItem(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/actions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Suppression impossible");
      setHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setDeletingId(null);
    }
  }

  /** Automatisation opt-in d'une famille : réglage serveur + rechargement
      (les actions en attente de la famille s'exécutent immédiatement). */
  async function toggleAutomation(key: string, enabled: boolean) {
    if (autoBusy) return;
    setAutoBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/actions/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Réglage impossible");
      setAutomated((prev) => (enabled ? [...new Set([...prev, key])] : prev.filter((k) => k !== key)));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAutoBusy(null);
    }
  }

  /** Cadence & conditions de sortie d'une famille (réglage serveur, borné). */
  async function saveSettings(key: string, patch: Record<string, number | boolean>) {
    const next = { ...(settings[key] ?? {}), ...patch };
    setSettings((prev) => ({ ...prev, [key]: next })); // optimiste
    try {
      const res = await fetch("/api/actions/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, cadence: next }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Réglage impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  /** Automatisation CIBLÉE : ce deal/cette entreprise/ce contact uniquement
      (include quand la famille est manuelle, exclude quand elle est auto). */
  async function toggleEntityAutomation(key: string, entityKey: string, list: "include" | "exclude", enabled: boolean) {
    if (autoBusy) return;
    setAutoBusy(`${key}:${entityKey}`);
    setError(null);
    try {
      const res = await fetch("/api/actions/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, entityKey, list, enabled }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Réglage impossible");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setAutoBusy(null);
    }
  }

  async function decide(id: string, decision: "approve" | "reject") {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Décision impossible");
      if (decision === "approve" && d.status === "failed" && d.detail) {
        setError(`Exécution en échec : ${d.detail}`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setBusyId(null);
    }
  }

  // Types & outils réellement présents (file + historique) → options des filtres.
  const all = [...(pending ?? []), ...history];
  const presentTypes = [...new Set(all.map((a) => a.type))];
  const presentTools = [...new Set(all.map((a) => TYPE_META[a.type]?.tool).filter((t): t is string => !!t))];
  const matches = (a: ActionItem) =>
    (!typeFilter || a.type === typeFilter) && (!toolFilter || TYPE_META[a.type]?.tool === toolFilter);
  const shownPending = (pending ?? []).filter(matches);
  const shownHistory = history.filter(matches);

  // Pagination de la file (la préférence 15/20/50 s'applique aussi à l'historique).
  const pageCount = Math.max(1, Math.ceil(shownPending.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pagedPending = shownPending.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const pagedHistory = shownHistory.slice(0, pageSize);

  return (
    <div className="space-y-6">
      {needsMigration && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          La table des actions n&apos;existe pas encore — applique la migration <code>action_items</code> pour activer la boîte d&apos;actions.
        </p>
      )}
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {/* ── Barre outils : catalogue des actions + lignes par page ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600"
        >
          Catalogue des actions
          {hidden.length > 0 && (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
              {ACTION_CATALOG.length - hidden.length}/{ACTION_CATALOG.length}
            </span>
          )}
        </button>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <span>Lignes :</span>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => changePageSize(n)}
              className={`rounded-md px-1.5 py-0.5 font-medium transition ${pageSize === n ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── Catalogue : choisir les familles d'actions affichées ── */}
      {catalogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setCatalogOpen(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-card-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-card-border bg-slate-50/70 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Catalogue des actions</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Choisis les familles d&apos;actions affichées dans la file — les familles masquées ne sont plus détectées.
                  « Auto » exécute la famille sans validation à chaque détection : c&apos;est toi qui décides,
                  et les fusions de doublons restent toujours manuelles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCatalogOpen(false)}
                aria-label="Fermer"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow ring-1 ring-black/5 hover:text-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {ACTION_CATALOG.map((c) => {
                const on = !hidden.includes(c.key);
                const isAuto = automated.includes(c.key);
                return (
                  <div key={c.key} className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition ${on ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 opacity-70"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                        {c.label}
                        {isAuto && on && (
                          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-emerald-600">Auto</span>
                        )}
                        {(() => {
                          const o = overrides[c.key];
                          const n = (o?.include.length ?? 0) + (o?.exclude.length ?? 0);
                          return n > 0 ? (
                            <span
                              title={`${o?.include.length ?? 0} entité(s) automatisée(s) spécifiquement · ${o?.exclude.length ?? 0} gardée(s) en manuel`}
                              className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500"
                            >
                              {n} exception{n > 1 ? "s" : ""}
                            </span>
                          ) : null;
                        })()}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{c.description}</p>
                      {!AUTOMATABLE.has(c.key) && (
                        <p className="mt-1 text-[10px] font-medium text-amber-600">Toujours validée manuellement (fusion irréversible).</p>
                      )}

                      {/* ── Cadence & conditions de sortie : explicites et choisies
                             par l'utilisateur (relais agent pour être conseillé). ── */}
                      {c.key === "overdue_invoice" && on && (() => {
                        const s = settings.overdue_invoice ?? {};
                        const interval = Number(s.intervalDays ?? 7);
                        const max = Number(s.maxRelances ?? 3);
                        return (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Cadence & conditions de sortie</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-slate-700">
                              <label className="flex items-center gap-1.5">
                                Relancer tous les
                                <input
                                  type="number"
                                  min={1}
                                  max={90}
                                  value={interval}
                                  onChange={(e) => void saveSettings("overdue_invoice", { intervalDays: Number(e.target.value) })}
                                  className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-accent"
                                />
                                jours
                              </label>
                              <label className="flex items-center gap-1.5">
                                Maximum
                                <input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={max}
                                  onChange={(e) => void saveSettings("overdue_invoice", { maxRelances: Number(e.target.value) })}
                                  className="w-12 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-accent"
                                />
                                relances
                              </label>
                            </div>
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                              <p className="text-slate-500">Sortie du cycle :</p>
                              <p className="flex items-center gap-1.5">
                                <span className="text-emerald-600">✓</span> Paiement intégral reçu — arrêt garanti, non désactivable
                              </p>
                              <label className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={Boolean(s.stopOnPartialPayment)}
                                  onChange={(e) => void saveSettings("overdue_invoice", { stopOnPartialPayment: e.target.checked })}
                                  className="accent-[var(--accent)]"
                                />
                                Un paiement <b>partiel</b> arrête aussi les relances
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={s.escalateAfterMax !== false}
                                  onChange={(e) => void saveSettings("overdue_invoice", { escalateAfterMax: e.target.checked })}
                                  className="accent-[var(--accent)]"
                                />
                                Après {max} relances : créer une tâche de recouvrement humaine (sinon arrêt simple)
                              </label>
                            </div>
                            <a
                              href={`/dashboard/agents/paiement-facturation?ask=${encodeURIComponent(
                                `Analyse mes impayés et mon comportement de paiement réel (DSO, délai moyen d'encaissement après relance, part des factures payées après la 1re/2e/3e relance) et recommande-moi la meilleure cadence de relance : tous les combien de jours, combien de relances maximum, et à partir de quand escalader en recouvrement humain. Ma cadence actuelle est : 1 relance tous les ${interval} jours, ${max} maximum.`,
                              )}`}
                              className="mt-2 inline-block text-[11px] font-medium text-accent hover:underline"
                            >
                              Demander conseil à l&apos;agent Trésorerie →
                            </a>
                          </div>
                        );
                      })()}

                      {c.key === "silent_deal" && on && (() => {
                        const days = Number(settings.silent_deal?.silentDays ?? 21);
                        return (
                          <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Seuil & conditions de sortie</p>
                            <label className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-700">
                              Relancer un deal sans contact depuis
                              <input
                                type="number"
                                min={3}
                                max={180}
                                value={days}
                                onChange={(e) => void saveSettings("silent_deal", { silentDays: Number(e.target.value) })}
                                className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-center text-[11px] outline-none focus:border-accent"
                              />
                              jours
                            </label>
                            <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                              <p className="text-slate-500">Sortie du cycle :</p>
                              <p className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Le contact répond — HubSpot le désinscrit de la séquence</p>
                              <p className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Deal gagné ou perdu — sortie du détecteur</p>
                              <p className="flex items-center gap-1.5"><span className="text-emerald-600">✓</span> Toute activité enregistrée sur le deal remet le compteur à zéro</p>
                            </div>
                            <a
                              href={`/dashboard/agents/performance?ask=${encodeURIComponent(
                                `Analyse mon cycle de vente et mes deals gagnés/perdus : au bout de combien de jours sans contact un deal ouvert décroche-t-il réellement ? Recommande-moi le seuil de silence à partir duquel déclencher une relance automatique (actuellement ${days} jours), en t'appuyant sur mes vraies données.`,
                              )}`}
                              className="mt-2 inline-block text-[11px] font-medium text-accent hover:underline"
                            >
                              Demander conseil à l&apos;agent Performances →
                            </a>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                        Affichée
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`Afficher : ${c.label}`}
                          onClick={() => toggleCatalog(c.key)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${on ? "bg-indigo-500" : "bg-slate-300"}`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${on ? "translate-x-[1.15rem]" : "translate-x-1"}`} />
                        </button>
                      </label>
                      {AUTOMATABLE.has(c.key) && on && (
                        <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
                          Auto
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isAuto}
                            aria-label={`Automatiser : ${c.label}`}
                            disabled={autoBusy === c.key}
                            onClick={() => void toggleAutomation(c.key, !isAuto)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50 ${isAuto ? "bg-emerald-500" : "bg-slate-300"}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${isAuto ? "translate-x-[1.15rem]" : "translate-x-1"}`} />
                          </button>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Filtres : par action et par outil ── */}
      {(presentTypes.length > 1 || presentTools.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-500">Action :</span>
            <button
              type="button"
              onClick={() => setTypeFilter("")}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!typeFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              Toutes
            </button>
            {presentTypes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(typeFilter === t ? "" : t)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${typeFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                {TYPE_META[t]?.label ?? t}
              </button>
            ))}
          </div>
          {presentTools.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-slate-500">Outil :</span>
              <button
                type="button"
                onClick={() => setToolFilter("")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition ${!toolFilter ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
              >
                Tous
              </button>
              {presentTools.map((t) => {
                const meta = Object.values(TYPE_META).find((m) => m.tool === t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setToolFilter(toolFilter === t ? "" : t)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${toolFilter === t ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {meta && <BrandLogo domain={meta.domain} alt={meta.toolLabel} fallback={meta.icon} size={12} />}
                    {meta?.toolLabel ?? t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── File d'attente : à valider ── */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          À valider
          <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-xs font-medium text-fuchsia-700">{shownPending.length}</span>
        </h2>

        {/* Suggestion contextuelle : une famille s'accumule (≥ 3 fiches) →
            proposer UNE fois de l'automatiser, au lieu d'un bouton par fiche. */}
        {(() => {
          const counts = new Map<string, number>();
          for (const a of shownPending) {
            const key = a.source.replace("detector:", "");
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
          const suggestions = [...counts.entries()]
            .filter(([key, n]) => n >= 3 && AUTOMATABLE.has(key) && !automated.includes(key))
            .sort((a, b) => b[1] - a[1])
            .slice(0, 2);
          if (suggestions.length === 0) return null;
          return suggestions.map(([key, n]) => {
            const label = ACTION_CATALOG.find((c) => c.key === key)?.label ?? key;
            return (
              <div key={key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-2.5">
                <p className="text-xs text-emerald-800">
                  <span className="font-semibold">{n} actions « {label} »</span> en attente — tu les valides une par une.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={autoBusy === key}
                    onClick={() => void toggleAutomation(key, true)}
                    className="rounded-lg bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {autoBusy === key ? "Activation…" : "⚡ Automatiser cette famille"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatalogOpen(true)}
                    className="text-[11px] font-medium text-emerald-700 transition hover:underline"
                  >
                    Gérer dans le catalogue
                  </button>
                </div>
              </div>
            );
          });
        })()}
        {pending === null ? (
          <p className="text-xs text-slate-400">Analyse de tes données…</p>
        ) : shownPending.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              {pending.length === 0 ? "Aucune action en attente." : "Aucune action ne correspond aux filtres."}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Les détecteurs (deals silencieux, impayés, doublons à fusionner) et les agents alimentent cette file — reviens après ta prochaine synchronisation.
            </p>
          </div>
        ) : (
          pagedPending.map((a) => {
            const meta = TYPE_META[a.type];
            return (
              <div key={a.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {meta && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        <BrandLogo domain={meta.domain} alt={meta.label} fallback={meta.icon} size={12} />
                        {meta.label}
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{sourceLabel(a.source)}</span>
                    <span className="text-[10px] text-slate-400">{fmtDate(a.created_at)}</span>
                  </div>
                  <p className="mt-1.5 text-sm font-semibold text-slate-900">{a.title}</p>
                  {a.description && <p className="mt-0.5 text-xs text-slate-500">{a.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-3">
                    {buildDetail(a) && (
                      <button
                        type="button"
                        onClick={() => setDetailId(detailId === a.id ? null : a.id)}
                        className="text-[11px] font-medium text-indigo-600 transition hover:underline"
                      >
                        {detailId === a.id ? "Masquer le détail ▴" : "Voir le détail ▾"}
                      </button>
                    )}
                    {/* Automatisation opt-in : globale, ciblée par entité, ou
                        exclusion d'un compte clé — décidée par l'utilisateur. */}
                    {(() => {
                      const key = a.source.replace("detector:", "");
                      if (!AUTOMATABLE.has(key)) return null;
                      const familyAuto = automated.includes(key);
                      const ref = a.entityRef;
                      const busyEntity = ref ? autoBusy === `${key}:${ref.key}` : false;
                      // Sur la fiche : UNIQUEMENT les liens ciblés sur l'entité
                      // (le réglage de famille vit dans le catalogue + bannière).
                      if (!familyAuto) {
                        if (!ref || a.entityIncluded) return null;
                        return (
                          <button
                            type="button"
                            disabled={busyEntity}
                            onClick={() => void toggleEntityAutomation(key, ref.key, "include", true)}
                            title={`Seules les actions de cette famille concernant ${ref.label} s'exécuteront automatiquement — le reste reste manuel.`}
                            className="text-[11px] font-medium text-emerald-600 transition hover:underline disabled:opacity-50"
                          >
                            {busyEntity ? "Activation…" : `⚡ Automatiser pour ${ref.label} uniquement`}
                          </button>
                        );
                      }
                      // Famille automatisée : cette fiche est encore en attente
                      // soit parce que l'entité est exclue, soit fraîchement détectée.
                      if (ref && a.entityExcluded) {
                        return (
                          <span className="flex items-center gap-2 text-[11px]">
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-600">Manuel pour {ref.label}</span>
                            <button
                              type="button"
                              disabled={busyEntity}
                              onClick={() => void toggleEntityAutomation(key, ref.key, "exclude", false)}
                              className="font-medium text-emerald-600 transition hover:underline disabled:opacity-50"
                            >
                              Réactiver l&apos;auto
                            </button>
                          </span>
                        );
                      }
                      if (ref) {
                        return (
                          <button
                            type="button"
                            disabled={busyEntity}
                            onClick={() => void toggleEntityAutomation(key, ref.key, "exclude", true)}
                            title={`Sécurité compte clé : les actions de cette famille concernant ${ref.label} resteront à valider manuellement, le reste de la famille demeure automatisé.`}
                            className="text-[11px] font-medium text-amber-600 transition hover:underline disabled:opacity-50"
                          >
                            {busyEntity ? "…" : `🔒 Garder ${ref.label} en manuel`}
                          </button>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => decide(a.id, "reject")}
                    disabled={busyId === a.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => decide(a.id, "approve")}
                    disabled={busyId === a.id || needsMigration}
                    className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
                  >
                    {busyId === a.id ? "Exécution…" : "✓ Valider — exécuter"}
                  </button>
                </div>
                {/* ── Détail : ce que la validation va exactement écrire, et pourquoi ── */}
                {detailId === a.id && (() => {
                  const d = buildDetail(a);
                  if (!d) return null;
                  return (
                    <div className="w-full basis-full rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Ce qui sera écrit à la validation
                      </p>
                      <dl className="mt-1.5 space-y-1">
                        {d.rows.map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-[11px]">
                            <dt className="w-36 shrink-0 font-medium text-slate-500">{k}</dt>
                            <dd className="min-w-0 whitespace-pre-line text-slate-700">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-2 border-t border-slate-200 pt-2 text-[11px] leading-relaxed text-slate-500">
                        {d.effect}
                      </p>
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
        {/* Pager de la file (quand elle dépasse une page) */}
        {shownPending.length > pageSize && (
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500">
            <span>
              {safePage * pageSize + 1}–{Math.min(shownPending.length, (safePage + 1) * pageSize)} sur {shownPending.length}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Page précédente"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Page suivante"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        )}
      </section>

      {/* ── Historique : dépliant (page légère), lignes supprimables ── */}
      {shownHistory.length > 0 && (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            className="flex w-full items-center gap-2 text-left text-base font-semibold text-slate-900 transition hover:text-indigo-700"
          >
            <span className={`text-xs text-slate-400 transition-transform ${historyOpen ? "rotate-90" : ""}`}>▶</span>
            Historique
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{shownHistory.length}</span>
            {historyOpen && shownHistory.length > pageSize && (
              <span className="text-[11px] font-normal text-slate-400">({pageSize} dernières affichées)</span>
            )}
          </button>
          {historyOpen && (
          <div className="card divide-y divide-slate-100">
            {pagedHistory.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{a.title}</p>
                  {a.status === "failed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-rose-500">{a.result.detail}</p>
                  )}
                  {a.status === "executed" && a.result?.detail && (
                    <p className="mt-0.5 text-[11px] text-slate-400">{a.result.detail}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.auto && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-600" title="Exécutée automatiquement (famille automatisée)">
                      Auto
                    </span>
                  )}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      a.status === "executed"
                        ? "bg-emerald-50 text-emerald-700"
                        : a.status === "rejected"
                          ? "bg-slate-100 text-slate-500"
                          : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    {a.status === "executed" ? "Exécutée" : a.status === "rejected" ? "Refusée" : "Échec"}
                  </span>
                  {a.decided_at && <span className="text-[10px] text-slate-400">{fmtDate(a.decided_at)}</span>}
                  {/* Suppression individuelle de la ligne d'historique */}
                  <button
                    type="button"
                    onClick={() => void deleteHistoryItem(a.id)}
                    disabled={deletingId === a.id}
                    title="Supprimer cette ligne de l'historique"
                    aria-label="Supprimer cette ligne de l'historique"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                  >
                    {deletingId === a.id ? "…" : "✕"}
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}
        </section>
      )}
    </div>
  );
}
