/**
 * Règles de déduplication — type + défauts, dans un module SANS "use client" :
 * importable par les composants serveur (la page Rapprochement de données).
 * NE PAS déplacer dans components/dedup-rules.tsx : les valeurs exportées d'un
 * module client deviennent des références client côté serveur (crash RSC).
 *
 * Libellés d'action en langage clair :
 * - « Fusion automatique » : fiches fusionnées uniquement si critères primaire
 *   ET secondaire concordent — désactivé par défaut, rien sans accord explicite.
 * - « Mise à jour sans doublon » : l'enregistrement déjà relié par son
 *   identifiant source est mis à jour au lieu d'être recréé — aucune fusion.
 */

export type DedupRule = {
  id: string;
  entity: string;
  criteria: string;
  secondaryCriteria: string;
  action: string;
  warning: string | null;
  enabled: boolean;
};

export const DEFAULT_DEDUP_RULES: DedupRule[] = [
  { id: "contact_email", entity: "Contact", criteria: "email corporate (hors génériques)", secondaryCriteria: "domaine + nom (entre CRM et billing)", action: "Fusion automatique", warning: "Ne PAS matcher l'email billing avec l'email du signataire", enabled: false },
  { id: "company_siren", entity: "Company", criteria: "SIREN exact (France)", secondaryCriteria: "VAT + domaine + nom normalisé", action: "Fusion automatique", warning: "Un groupe avec 3 filiales = 3 SIRENs", enabled: false },
  { id: "company_intl_vat", entity: "Company (int.)", criteria: "VAT number (hors France)", secondaryCriteria: "domaine + nom + pays", action: "Fusion automatique", warning: "Le VAT change en cas de restructuration dans certains pays UE", enabled: false },
  { id: "deal_external_id", entity: "Deal", criteria: "external_id par source", secondaryCriteria: "company_id + amount + mois de close", action: "Mise à jour sans doublon", warning: null, enabled: false },
  { id: "invoice_source_id", entity: "Invoice", criteria: "source_id (stripe_id / pennylane_id)", secondaryCriteria: "number + montant + date", action: "Mise à jour sans doublon", warning: "Un avoir peut avoir le même montant qu'une facture", enabled: false },
  { id: "ticket_source_id", entity: "Ticket", criteria: "source_id (zendesk_id / intercom_id)", secondaryCriteria: "external_number + opened_at", action: "Mise à jour sans doublon", warning: null, enabled: false },
];
