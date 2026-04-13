/**
 * Identifier catalog: defines which canonical identifiers each provider
 * can supply, and the default field name where the value is found.
 *
 * Used by the data model page to dynamically show mapping fields
 * based on which tools the user has actually connected.
 */

export type IdentifierDef = {
  canonicalField: "siren" | "siret" | "vat_number" | "external_id";
  label: string;
  /** Default field name in the provider (user can override) */
  defaultProviderField: string;
  /** How the provider stores this (for UX help text) */
  hint: string;
  /** Is this field always present in the provider (native) or needs custom config? */
  native: boolean;
};

/** Per-provider identifier capabilities */
export const PROVIDER_IDENTIFIERS: Record<string, IdentifierDef[]> = {
  // ── CRM ──
  hubspot: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "siren", hint: "Propriété custom HubSpot (à créer si inexistant)", native: false },
    { canonicalField: "siret", label: "SIRET", defaultProviderField: "siret", hint: "Propriété custom HubSpot", native: false },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "vat_number", hint: "Propriété custom HubSpot", native: false },
    { canonicalField: "external_id", label: "ID Company", defaultProviderField: "hs_object_id", hint: "ID natif HubSpot (automatique)", native: true },
  ],
  salesforce: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "SIREN__c", hint: "Champ custom Salesforce", native: false },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "VAT_Number__c", hint: "Champ custom Salesforce", native: false },
    { canonicalField: "external_id", label: "Account ID", defaultProviderField: "Id", hint: "ID natif Salesforce (automatique)", native: true },
  ],
  pipedrive: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "siren", hint: "Champ custom Pipedrive", native: false },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "vat_number", hint: "Champ custom Pipedrive", native: false },
    { canonicalField: "external_id", label: "Organization ID", defaultProviderField: "id", hint: "ID natif Pipedrive (automatique)", native: true },
  ],
  zoho: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "SIREN", hint: "Champ custom Zoho", native: false },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "VAT_Number", hint: "Champ custom Zoho", native: false },
    { canonicalField: "external_id", label: "Account ID", defaultProviderField: "id", hint: "ID natif Zoho (automatique)", native: true },
  ],
  monday: [
    { canonicalField: "external_id", label: "Item ID", defaultProviderField: "id", hint: "ID natif monday (automatique)", native: true },
  ],

  // ── Billing / ERP ──
  stripe: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "metadata.siren", hint: "Stocké dans customer.metadata.siren", native: false },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "tax_id", hint: "Tax ID natif Stripe (si configuré)", native: true },
    { canonicalField: "external_id", label: "Customer ID", defaultProviderField: "id", hint: "cus_XXXXX (automatique)", native: true },
  ],
  pennylane: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "registration_number", hint: "Champ natif Pennylane — toujours renseigné", native: true },
    { canonicalField: "siret", label: "SIRET", defaultProviderField: "siret", hint: "Champ natif Pennylane", native: true },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "vat_number", hint: "Champ natif Pennylane", native: true },
    { canonicalField: "external_id", label: "Client ID", defaultProviderField: "id", hint: "ID natif Pennylane (automatique)", native: true },
  ],
  sellsy: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "siret", hint: "Champ natif Sellsy (9 premiers = SIREN)", native: true },
    { canonicalField: "siret", label: "SIRET", defaultProviderField: "siret", hint: "Champ natif Sellsy", native: true },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "vat_number", hint: "Champ natif Sellsy", native: true },
    { canonicalField: "external_id", label: "Client ID", defaultProviderField: "id", hint: "ID natif Sellsy (automatique)", native: true },
  ],
  axonaut: [
    { canonicalField: "siren", label: "SIREN", defaultProviderField: "registration_number", hint: "N° SIREN natif Axonaut", native: true },
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "intracommunity_number", hint: "Champ natif Axonaut", native: true },
    { canonicalField: "external_id", label: "Company ID", defaultProviderField: "id", hint: "ID natif Axonaut (automatique)", native: true },
  ],
  quickbooks: [
    { canonicalField: "vat_number", label: "N° TVA", defaultProviderField: "PrimaryTaxIdentifier", hint: "Tax ID natif QuickBooks", native: true },
    { canonicalField: "external_id", label: "Customer ID", defaultProviderField: "Id", hint: "ID natif QuickBooks (automatique)", native: true },
  ],

  // ── Support ──
  zendesk: [
    { canonicalField: "external_id", label: "Organization ID", defaultProviderField: "id", hint: "ID natif Zendesk (automatique)", native: true },
  ],
  intercom: [
    { canonicalField: "external_id", label: "Company ID", defaultProviderField: "id", hint: "ID natif Intercom (automatique)", native: true },
  ],
  freshdesk: [
    { canonicalField: "external_id", label: "Company ID", defaultProviderField: "id", hint: "ID natif Freshdesk (automatique)", native: true },
  ],
  crisp: [
    { canonicalField: "external_id", label: "People ID", defaultProviderField: "people_id", hint: "ID natif Crisp (automatique)", native: true },
  ],
};

/** Canonical identifier definitions (Tier 1 + Tier 2 only — fiable) */
export const CANONICAL_IDENTIFIERS = [
  {
    field: "siren" as const,
    label: "SIREN",
    description: "Numéro à 9 chiffres INSEE — identifie une personne morale française de manière unique et permanente.",
    confidence: 99,
    tier: 1,
  },
  {
    field: "siret" as const,
    label: "SIRET",
    description: "14 chiffres (SIREN + NIC) — identifie un établissement. Change au déménagement, moins stable que le SIREN.",
    confidence: 90,
    tier: 1,
  },
  {
    field: "vat_number" as const,
    label: "N° TVA intracommunautaire",
    description: "Attribué par l'administration fiscale. Fiable sauf micro-entreprises (pas de TVA) et restructurations.",
    confidence: 97,
    tier: 1,
  },
  {
    field: "external_id" as const,
    label: "ID externe (customer_id)",
    description: "Identifiant technique propre à chaque outil. Match 1:1 exact. Créé automatiquement par Revold lors de la première sync.",
    confidence: 100,
    tier: 2,
  },
] as const;
