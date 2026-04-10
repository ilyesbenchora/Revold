import { ParametresTabs } from "@/components/parametres-tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgId } from "@/lib/supabase/cached";

const inputClass = "w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const selectClass = inputClass;

// ── Field authority matrix ──────────────────────────────────────
const FIELD_AUTHORITY = [
  { entity: "Contact", field: "email", priority: ["Stripe", "HubSpot", "Pipedrive", "Zoho", "Salesforce"], rationale: "L'email facturé est vérifié → source de vérité" },
  { entity: "Contact", field: "phone", priority: ["HubSpot", "Pipedrive", "Aircall", "Kaspr"], rationale: "Le commercial qualifie le téléphone dans le CRM" },
  { entity: "Contact", field: "title", priority: ["LinkedIn Sales Nav", "HubSpot", "Kaspr"], rationale: "LinkedIn est la source la plus à jour pour les titres" },
  { entity: "Contact", field: "owner", priority: ["HubSpot", "Pipedrive"], rationale: "L'attribution commerciale est gérée dans le CRM principal" },
  { entity: "Company", field: "name", priority: ["HubSpot", "Pipedrive", "Stripe"], rationale: "Le commercial qualifie le nom officiel" },
  { entity: "Company", field: "domain", priority: ["Kaspr", "Dropcontact", "HubSpot"], rationale: "Les outils d'enrichissement sont plus fiables" },
  { entity: "Company", field: "siren", priority: ["Pennylane", "Sellsy", "Axonaut", "HubSpot"], rationale: "L'outil comptable a le SIREN officiel" },
  { entity: "Company", field: "vat_number", priority: ["Pennylane", "Sellsy", "Stripe", "QuickBooks"], rationale: "L'outil de facturation a le n° TVA vérifié" },
  { entity: "Company", field: "industry", priority: ["LinkedIn Sales Nav", "Kaspr", "HubSpot"], rationale: "Source d'enrichissement plus fraîche" },
  { entity: "Company", field: "annual_revenue", priority: ["LinkedIn Sales Nav", "ZoomInfo", "HubSpot"], rationale: "Les bases d'enrichissement B2B" },
  { entity: "Deal", field: "stage", priority: ["HubSpot", "Pipedrive", "Salesforce"], rationale: "Le pipeline est piloté dans le CRM" },
  { entity: "Deal", field: "amount", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "Le montant facturé > montant forecast" },
  { entity: "Deal", field: "close_date", priority: ["Stripe", "Pennylane", "HubSpot"], rationale: "La date de paiement est la close_date réelle" },
  { entity: "Invoice", field: "all", priority: ["Stripe", "Pennylane", "Sellsy", "Axonaut", "QuickBooks"], rationale: "Toujours la source originale" },
  { entity: "Subscription", field: "mrr", priority: ["Stripe", "Pennylane"], rationale: "Le MRR n'existe que dans le billing" },
  { entity: "Ticket", field: "all", priority: ["Zendesk", "Intercom", "Freshdesk", "Crisp"], rationale: "Toujours la source ticketing native" },
];

// ── Entity resolution rules — confidence levels calibrated by a CRO/CTO/DAF
// who has seen every edge case in multi-tool B2B environments ──────────────

const RESOLUTION_RULES = [
  // ── TIER 1 : Identifiants légaux (les seuls vrais "sources de vérité") ──
  {
    id: "siren_match",
    rule: "Match par SIREN",
    entity: "Company",
    description: "Le SIREN (9 chiffres INSEE) identifie une personne morale française de manière unique et permanente. C'est l'ID le plus fiable dans un contexte multi-outils B2B FR : il ne change jamais, même en cas de déménagement ou de changement de nom commercial.",
    confidence: 99,
    enabled: true,
    warning: "Un même groupe peut avoir plusieurs SIRENs (1 par entité juridique : holding, filiale, SCI…). Le SIREN ne résout PAS le cas des structures multi-entités.",
    configFields: [
      { label: "Activer le match SIREN", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Source SIREN prioritaire", type: "select", options: ["Pennylane (natif)", "Sellsy (natif)", "Axonaut (natif)", "Stripe (customer.metadata.siren)", "HubSpot (champ custom)", "Import CSV"], value: "Pennylane (natif)" },
      { label: "Gestion multi-entités", type: "select", options: ["1 SIREN = 1 company (strict)", "Grouper par racine SIREN (même groupe)", "Demander confirmation"], value: "1 SIREN = 1 company (strict)" },
    ],
  },
  {
    id: "vat_match",
    rule: "Match par n° TVA intracommunautaire",
    entity: "Company",
    description: "Le n° TVA (FR + 11 chiffres) est attribué par l'administration fiscale. Fiable à 97% : il peut changer en cas de restructuration, et les entreprises sous le seuil de TVA n'en ont pas.",
    confidence: 97,
    enabled: true,
    warning: "Les micro-entreprises et associations n'ont pas de TVA. Certains outils (CRM) stockent un format avec espaces alors que d'autres (facturation) stockent sans espaces.",
    configFields: [
      { label: "Validation du format", type: "select", options: ["Stricte (regex FR/DE/BE/ES/IT/NL)", "Souple (juste présence)"], value: "Stricte (regex FR/DE/BE/ES/IT/NL)" },
      { label: "Normalisation", type: "select", options: ["Retirer espaces + tirets", "Format exact"], value: "Retirer espaces + tirets" },
    ],
  },
  {
    id: "siret_match",
    rule: "Match par SIRET (établissement)",
    entity: "Company",
    description: "Le SIRET (14 chiffres = SIREN + NIC) identifie un établissement spécifique. Moins stable que le SIREN car il change quand l'entreprise déménage son siège social.",
    confidence: 90,
    enabled: true,
    warning: "Lors d'un déménagement, le SIRET change (nouveau NIC) mais le SIREN reste. Préférer le match SIREN et utiliser SIRET comme signal secondaire.",
    configFields: [
      { label: "Activer le match SIRET", type: "select", options: ["Oui (complément du SIREN)", "Non"], value: "Oui (complément du SIREN)" },
      { label: "Fallback si SIREN absent", type: "select", options: ["Extraire le SIREN du SIRET (9 premiers chiffres)", "Ignorer"], value: "Extraire le SIREN du SIRET (9 premiers chiffres)" },
    ],
  },

  // ── TIER 2 : Identifiants techniques stables ──
  {
    id: "exact_email",
    rule: "Match par email exact",
    entity: "Contact",
    description: "Match sur email lowercase. ATTENTION : l'email de facturation (comptabilite@, admin@, facturation@) est rarement l'email du contact commercial (jean.dupont@) qui a signé le devis. Un match email entre CRM et outil de facturation peut donner un FAUX contact.",
    confidence: 85,
    enabled: true,
    warning: "Cas fréquent : Stripe a 'facturation@acme.com', HubSpot a 'jean@acme.com'. Ce ne sont PAS la même personne. Le match email seul ne suffit pas entre CRM et billing — il faut croiser avec le domaine + le SIREN.",
    configFields: [
      { label: "Normalisation", type: "select", options: ["Lowercase + trim", "Lowercase + trim + remove dots (Gmail)", "Aucune"], value: "Lowercase + trim" },
      { label: "Emails génériques", type: "select", options: ["Bloquer (info@, contact@, support@, facturation@, comptabilite@, admin@)", "Avertir seulement", "Autoriser"], value: "Bloquer (info@, contact@, support@, facturation@, comptabilite@, admin@)" },
      { label: "Match CRM ↔ Billing", type: "select", options: ["Email + domaine obligatoire (recommandé)", "Email seul (risqué)", "Désactivé entre CRM et billing"], value: "Email + domaine obligatoire (recommandé)" },
    ],
  },
  {
    id: "domain_match",
    rule: "Match par domaine web",
    entity: "Company",
    description: "Companies avec le même domaine web. Confiance limitée à 75% car : (1) holding et filiale ont souvent des domaines différents, (2) une entité de facturation peut utiliser le domaine du groupe et non celui de la filiale, (3) un rebranding change le domaine dans le CRM mais pas dans l'outil comptable.",
    confidence: 75,
    enabled: true,
    warning: "Cas classique : 'Groupe Alpha' facture via alpha-group.com, mais le CRM a 'Alpha Digital' avec alpha-digital.fr. Mêmes personnes, même contrat, domaines différents → le match échoue. Il faut combiner avec SIREN.",
    configFields: [
      { label: "Exclure domaines perso", type: "select", options: ["Oui (gmail, hotmail, yahoo, outlook, orange, free, sfr, wanadoo, laposte)", "Non"], value: "Oui (gmail, hotmail, yahoo, outlook, orange, free, sfr, wanadoo, laposte)" },
      { label: "Normalisation", type: "select", options: ["Retirer www. + sous-domaines + trailing slash", "Domaine exact"], value: "Retirer www. + sous-domaines + trailing slash" },
      { label: "Variantes pays", type: "select", options: ["Matcher .fr et .com comme identiques", "Traiter comme domaines distincts"], value: "Traiter comme domaines distincts" },
      { label: "Exiger un second identifiant", type: "select", options: ["Oui (domaine + SIREN ou VAT)", "Non (domaine seul suffit)"], value: "Oui (domaine + SIREN ou VAT)" },
    ],
  },

  // ── TIER 3 : Identifiants changeants / peu fiables ──
  {
    id: "linkedin_match",
    rule: "Match par URL LinkedIn",
    entity: "Contact + Company",
    description: "Le profil LinkedIn identifie un individu, la page entreprise identifie une société. Confiance limitée à 60% car : (1) les slugs changent quand quelqu'un édite son profil, (2) certains outils stockent l'URL, d'autres le slug, (3) les pages entreprise peuvent être fusionnées ou scindées côté LinkedIn.",
    confidence: 60,
    enabled: false,
    warning: "Un contact qui change de job modifie souvent son slug LinkedIn. Le CRM a l'ancien slug, LinkedIn Sales Nav a le nouveau. Match cassé.",
    configFields: [
      { label: "Contact", type: "select", options: ["Actif (signal secondaire)", "Inactif"], value: "Actif (signal secondaire)" },
      { label: "Company", type: "select", options: ["Actif (signal secondaire)", "Inactif"], value: "Inactif" },
      { label: "Normalisation URL", type: "select", options: ["Extraire le slug /in/{slug}", "URL complète"], value: "Extraire le slug /in/{slug}" },
      { label: "Utiliser seul ou en combinaison", type: "select", options: ["Combinaison obligatoire (LinkedIn + email OU domain)", "Seul suffit (déconseillé)"], value: "Combinaison obligatoire (LinkedIn + email OU domain)" },
    ],
  },
  {
    id: "secondary_email",
    rule: "Match par email secondaire",
    entity: "Contact",
    description: "Match sur le champ secondary_email. Confiance basse (55%) car : ce champ est rarement à jour, et l'email secondaire d'un contact dans HubSpot est souvent son email perso (pas celui utilisé dans l'outil de facturation).",
    confidence: 55,
    enabled: false,
    warning: "L'email secondaire n'est cohérent que si les deux outils l'ont saisi dans le même contexte (ex: deux CRM). Entre un CRM et un billing, il n'y a aucune garantie que l'email secondaire soit le même.",
    configFields: [
      { label: "Activer", type: "select", options: ["Oui (signal secondaire uniquement)", "Non"], value: "Non" },
      { label: "Exiger un match primaire", type: "select", options: ["Oui (ne match QUE si email principal déjà matché)", "Non (match indépendant)"], value: "Oui (ne match QUE si email principal déjà matché)" },
    ],
  },
  {
    id: "phone_match",
    rule: "Match par téléphone",
    entity: "Contact",
    description: "Match sur numéro normalisé E.164. Confiance très basse (45%) car : (1) formats incohérents entre outils (06 vs +336 vs 0033 6), (2) numéros de standard partagés, (3) changements d'opérateur, (4) le numéro du CRM est souvent le mobile, celui du billing est le fixe de l'entreprise.",
    confidence: 45,
    enabled: false,
    warning: "NE JAMAIS utiliser seul. Toujours en combinaison avec un identifiant plus fiable. Les numéros de téléphone standard (accueil) sont partagés par tous les contacts d'une entreprise → faux positifs massifs.",
    configFields: [
      { label: "Format cible", type: "select", options: ["+33 (E.164 FR)", "+1 (E.164 US)", "Auto-détection par country_code"], value: "+33 (E.164 FR)" },
      { label: "Exclure les fixes", type: "select", options: ["Oui (01, 02, 03, 04, 05 = standard partagé)", "Non"], value: "Oui (01, 02, 03, 04, 05 = standard partagé)" },
      { label: "Exiger un match primaire", type: "select", options: ["Oui (obligatoire)", "Non (déconseillé)"], value: "Oui (obligatoire)" },
    ],
  },
  {
    id: "fuzzy_name",
    rule: "Match par nom entreprise (fuzzy)",
    entity: "Company",
    description: "Distance de Levenshtein < seuil + même pays. Confiance 50% car : (1) 'Alpha Consulting SAS' et 'Alpha Conseil SARL' matchent mais ce sont peut-être 2 sociétés distinctes, (2) les noms de marque (DBA) diffèrent du nom légal utilisé en facturation.",
    confidence: 50,
    enabled: false,
    warning: "Source majeure de FAUX POSITIFS. Un même nom commercial peut correspondre à des entités juridiques totalement distinctes. Toujours exiger un identifiant complémentaire (SIREN, TVA ou domaine) pour confirmer.",
    configFields: [
      { label: "Seuil Levenshtein", type: "input", value: "3 caractères" },
      { label: "Même pays obligatoire", type: "select", options: ["Oui", "Non"], value: "Oui" },
      { label: "Ignorer suffixes juridiques", type: "select", options: ["Oui (SAS, SARL, SA, SASU, EURL, SCI, GmbH, Ltd, Inc, Corp, LLC)", "Non"], value: "Oui (SAS, SARL, SA, SASU, EURL, SCI, GmbH, Ltd, Inc, Corp, LLC)" },
      { label: "Exiger un second identifiant", type: "select", options: ["Oui (nom + SIREN ou domaine ou VAT)", "Non (nom seul suffit — RISQUÉ)"], value: "Oui (nom + SIREN ou domaine ou VAT)" },
    ],
  },

  // ── TIER 4 : Réconciliation manuelle ──
  {
    id: "manual_reconciliation",
    rule: "Réconciliation manuelle (queue)",
    entity: "Tous",
    description: "Les enregistrements non-matchés par aucune règle automatique sont placés dans une queue de réconciliation. L'utilisateur (DAF, CRO, ops) valide ou rejette manuellement chaque rapprochement.",
    confidence: null,
    enabled: true,
    warning: null,
    configFields: [
      { label: "Seuil auto-match minimum", type: "input", value: "80%" },
      { label: "Alerter si queue > N items", type: "input", value: "50 items" },
      { label: "Notifier par email", type: "select", options: ["Oui (1x/jour)", "Non"], value: "Oui (1x/jour)" },
      { label: "Afficher les suggestions (match probable)", type: "select", options: ["Oui avec le score de confiance", "Non"], value: "Oui avec le score de confiance" },
    ],
  },
];

// ── Dedup rules — réalistes par rapport aux cas d'usage CRM × billing × support
const DEDUP_RULES = [
  { entity: "Contact", criteria: "email corporate (hors génériques)", secondaryCriteria: "domaine + nom (entre CRM et billing)", action: "Merge auto", warning: "Ne PAS matcher l'email billing (facturation@) avec l'email du signataire (jean@)", enabled: true },
  { entity: "Company", criteria: "SIREN exact (France)", secondaryCriteria: "VAT + domaine + nom normalisé", action: "Merge auto", warning: "Un groupe avec 3 filiales = 3 SIRENs → vérifier si c'est une filiale ou la même entité", enabled: true },
  { entity: "Company (int.)", criteria: "VAT number (hors France)", secondaryCriteria: "domaine + nom + pays", action: "Merge auto", warning: "Le VAT change en cas de restructuration dans certains pays UE", enabled: true },
  { entity: "Deal", criteria: "external_id par source", secondaryCriteria: "company_id + amount + mois de close", action: "Upsert via source_links", warning: null, enabled: true },
  { entity: "Invoice", criteria: "source_id (stripe_id / pennylane_id)", secondaryCriteria: "number + montant + date", action: "Upsert via source_links", warning: "Un avoir (credit note) peut avoir le même montant qu'une facture → vérifier le type", enabled: true },
  { entity: "Ticket", criteria: "source_id (zendesk_id / intercom_id)", secondaryCriteria: "external_number + opened_at", action: "Upsert via source_links", warning: null, enabled: true },
];

export default async function ParametresModeleDonneesPage() {
  const orgId = await getOrgId();
  if (!orgId) return <p className="p-8 text-center text-sm text-slate-600">Non authentifié.</p>;

  const supabase = await createSupabaseServerClient();
  let sourceLinksCount = 0;
  let contactsCount = 0;
  let companiesCount = 0;
  try {
    const [sl, co, cp] = await Promise.all([
      supabase.from("source_links").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("contacts").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
      supabase.from("companies").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
    ]);
    sourceLinksCount = sl.count ?? 0;
    contactsCount = co.count ?? 0;
    companiesCount = cp.count ?? 0;
  } catch {}

  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
        <p className="mt-1 text-sm text-slate-500">
          Modèle de données canonique, règles de résolution multi-sources et déduplication.
          Ce paramétrage est l&apos;ADN de Revold — il détermine comment les outils communiquent entre eux.
        </p>
      </header>

      <ParametresTabs />

      {/* KPIs du modèle */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Liens sources</p>
          <p className="mt-1 text-3xl font-bold text-violet-600">{sourceLinksCount}</p>
          <p className="mt-1 text-xs text-slate-400">External ID → Revold</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Contacts canoniques</p>
          <p className="mt-1 text-3xl font-bold text-blue-600">{contactsCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Sociétés canoniques</p>
          <p className="mt-1 text-3xl font-bold text-indigo-600">{companiesCount.toLocaleString("fr-FR")}</p>
        </article>
        <article className="card p-5 text-center">
          <p className="text-xs text-slate-500">Règles actives</p>
          <p className="mt-1 text-3xl font-bold text-emerald-600">
            {RESOLUTION_RULES.filter((r) => r.enabled).length}/{RESOLUTION_RULES.length}
          </p>
        </article>
      </div>

      {/* ── Identifiants uniques d'entreprise ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-fuchsia-500" />Identifiants uniques d&apos;entreprise
        </h2>
        <p className="text-sm text-slate-500">
          Ces champs sont les clés de rapprochement les plus fiables entre outils.
          Quand Pennylane et HubSpot ont le même SIREN, c&apos;est la même entreprise — 100% certain.
        </p>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans HubSpot</label>
              <input type="text" defaultValue="siren" placeholder="siren (nom du champ custom HubSpot)" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">Nom de la propriété HubSpot qui contient le SIREN (9 chiffres)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIRET dans HubSpot</label>
              <input type="text" defaultValue="siret" placeholder="siret" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">Nom de la propriété pour le SIRET (14 chiffres, établissement)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ TVA dans HubSpot</label>
              <input type="text" defaultValue="vat_number" placeholder="vat_number" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">N° TVA intracommunautaire (ex: FR12345678901)</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ LinkedIn Company dans HubSpot</label>
              <input type="text" defaultValue="linkedin_company_page" placeholder="linkedin_company_page" className={inputClass} />
              <p className="mt-1 text-[10px] text-slate-400">URL de la page LinkedIn entreprise</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans Stripe (metadata key)</label>
              <input type="text" defaultValue="siren" placeholder="siren (dans customer.metadata)" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Champ SIREN dans Pennylane</label>
              <input type="text" defaultValue="siren" placeholder="Automatique (champ natif Pennylane)" className={inputClass} />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer le mapping
            </button>
          </div>
        </div>
      </div>

      {/* ── Règles de résolution d'entités ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-blue-500" />Règles de résolution d&apos;entités
        </h2>
        <p className="text-sm text-slate-500">
          Comment Revold décide qu&apos;un contact Stripe et un contact HubSpot sont la même personne,
          ou que deux sociétés dans Pennylane et HubSpot sont la même entreprise.
          Ordonnez les règles par fiabilité décroissante — la première match qui passe gagne.
        </p>
        <div className="space-y-3">
          {RESOLUTION_RULES.map((rule) => (
            <article key={rule.id} className="card overflow-hidden">
              <div className="flex items-start justify-between gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{rule.entity}</span>
                    <h3 className="text-sm font-semibold text-slate-900">{rule.rule}</h3>
                    {rule.confidence != null && (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        rule.confidence >= 95 ? "bg-emerald-100 text-emerald-700" :
                        rule.confidence >= 80 ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {rule.confidence}% confiance
                      </span>
                    )}
                    {rule.confidence === null && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Validation humaine
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{rule.description}</p>
                  {rule.warning && (
                    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 text-amber-600">
                        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <p className="text-[11px] text-amber-800">{rule.warning}</p>
                    </div>
                  )}
                </div>
                <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" className="peer sr-only" defaultChecked={rule.enabled} />
                  <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                </label>
              </div>
              {/* Configuration fields */}
              <div className="border-t border-card-border bg-slate-50/50 px-4 py-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {rule.configFields.map((f) => (
                    <div key={f.label}>
                      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{f.label}</label>
                      {"options" in f && f.options ? (
                        <select defaultValue={f.value} className={selectClass + " mt-1 text-xs"}>
                          {f.options.map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type="text" defaultValue={f.value} className={inputClass + " mt-1 text-xs"} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
        <div className="flex justify-end">
          <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
            Enregistrer les règles
          </button>
        </div>
      </div>

      {/* ── Field authority matrix ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-violet-500" />Priorité des sources par champ
        </h2>
        <p className="text-sm text-slate-500">
          Quand plusieurs outils ont la même donnée, Revold utilise cette matrice pour décider quelle source fait foi.
          L&apos;ordre de priorité est modifiable par glisser-déposer (bientôt).
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Champ</th>
                <th className="px-5 py-2">Ordre de priorité</th>
                <th className="px-5 py-2">Logique</th>
              </tr>
            </thead>
            <tbody>
              {FIELD_AUTHORITY.map((row, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{row.entity}</span>
                  </td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-700">{row.field}</td>
                  <td className="px-5 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {row.priority.map((p, idx) => (
                        <span key={p} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          idx === 0 ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-600"
                        }`}>
                          {idx + 1}. {p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-2.5 text-xs text-slate-500">{row.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Dedup rules ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />Règles de déduplication
        </h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <th className="px-5 py-2">Entité</th>
                <th className="px-5 py-2">Critère principal</th>
                <th className="px-5 py-2">Critères secondaires</th>
                <th className="px-5 py-2">Action</th>
                <th className="px-5 py-2">Actif</th>
              </tr>
            </thead>
            <tbody>
              {DEDUP_RULES.map((r, i) => (
                <tr key={i} className="border-b border-card-border last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-800">{r.entity}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-slate-600">{r.criteria}</td>
                  <td className="px-5 py-2.5 text-xs text-slate-500">{r.secondaryCriteria}</td>
                  <td className="px-5 py-2.5">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">{r.action}</span>
                    {r.warning && (
                      <p className="mt-1 text-[10px] text-amber-700">{r.warning}</p>
                    )}
                  </td>
                  <td className="px-5 py-2.5">
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input type="checkbox" className="peer sr-only" defaultChecked={r.enabled} />
                      <div className="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-emerald-500 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Sync schedule ── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="h-2 w-2 rounded-full bg-amber-500" />Fréquence de synchronisation
        </h2>
        <div className="card p-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500">Sync CRM (HubSpot, Pipedrive…)</label>
              <select defaultValue="hourly" className={selectClass + " mt-1"}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1 fois par jour</option>
                <option value="manual">Manuelle uniquement</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync billing (Stripe, Pennylane…)</label>
              <select defaultValue="webhook" className={selectClass + " mt-1"}>
                <option value="webhook">Webhooks temps réel</option>
                <option value="hourly">Toutes les heures</option>
                <option value="daily">1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Sync support (Zendesk, Intercom…)</label>
              <select defaultValue="hourly" className={selectClass + " mt-1"}>
                <option value="hourly">Toutes les heures</option>
                <option value="4h">Toutes les 4 heures</option>
                <option value="daily">1 fois par jour</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Calcul des KPIs et scores</label>
              <select defaultValue="daily" className={selectClass + " mt-1"}>
                <option value="daily">1 fois par jour (recommandé)</option>
                <option value="twice">2 fois par jour</option>
                <option value="realtime">Temps réel (Enterprise)</option>
              </select>
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500">
              Enregistrer la planification
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
