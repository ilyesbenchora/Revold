/**
 * Couche de mapping des identifiants consommée PAR LA SYNC.
 *
 * C'est le chaînon entre le mapping déclaratif (identifier-catalog.ts, défauts
 * par outil) + les overrides utilisateur (table identifier_field_mapping, page
 * Paramètres → Modèle de données) et les connecteurs. Un connecteur n'accède
 * plus aux champs source en dur : il demande à l'accessor « donne-moi le SIREN,
 * l'email, le nom d'entreprise de ce record » et la couche résout le chemin
 * réel (ex. Stripe `metadata.siren`, Pennylane `registration_number`).
 *
 * Conséquence : corriger un mapping dans les paramètres change réellement la
 * prochaine sync — y compris pour un outil jamais testé chez Revold, tant que
 * ses payloads sont passés à l'accessor.
 *
 * L'accessor compte aussi la COUVERTURE de chaque identifiant (combien de
 * records l'avaient renseigné) : c'est la matière première de l'audit
 * d'onboarding montré à l'utilisateur.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PROVIDER_IDENTIFIERS, type IdentifierDef } from "@/lib/integrations/identifier-catalog";

export type CanonicalIdentifier = IdentifierDef["canonicalField"];

export type ExtractedIdentifiers = Partial<Record<CanonicalIdentifier, string>>;

export type IdentifierCoverage = Record<
  string,
  { present: number; total: number; path: string; native: boolean; overridden: boolean }
>;

export type IdentifierAccessor = {
  provider: string;
  /** Chemin effectif par champ canonique (défaut catalogue ou override user). */
  paths: Partial<Record<CanonicalIdentifier, string>>;
  /** Champs dont le chemin vient de la table identifier_field_mapping. */
  overridden: Set<string>;
  /** Extrait les identifiants canoniques d'un payload source (dot-paths). */
  extract: (record: unknown) => ExtractedIdentifiers;
  /** Couverture observée depuis la création de l'accessor (pour l'audit). */
  coverage: () => IdentifierCoverage;
};

/**
 * Résout un chemin pointé ("metadata.siren", "emails.0") dans un objet.
 * Tolérant : un tableau sans index explicite prend son premier élément —
 * les outils facturation renvoient souvent `emails: [...]`.
 */
export function getByPath(record: unknown, path: string): string | null {
  let cur: unknown = record;
  for (const seg of path.split(".")) {
    if (cur == null) return null;
    if (Array.isArray(cur)) {
      const idx = /^\d+$/.test(seg) ? Number(seg) : NaN;
      cur = Number.isNaN(idx) ? (cur[0] as Record<string, unknown> | undefined)?.[seg] : cur[idx];
      continue;
    }
    if (typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[seg];
  }
  if (cur == null) return null;
  if (Array.isArray(cur)) cur = cur[0];
  if (cur == null || typeof cur === "object") return null;
  const s = String(cur).trim();
  return s || null;
}

// Cache court : une sync traite les records en rafale.
const _cache = new Map<string, { rows: Array<{ canonical_field: string; provider_field: string }>; at: number }>();

async function loadOverrides(
  sb: SupabaseClient,
  orgId: string,
  provider: string,
): Promise<Array<{ canonical_field: string; provider_field: string }>> {
  const key = `${orgId}:${provider}`;
  const cached = _cache.get(key);
  if (cached && Date.now() - cached.at < 60_000) return cached.rows;
  try {
    const { data } = await sb
      .from("identifier_field_mapping")
      .select("canonical_field, provider_field")
      .eq("organization_id", orgId)
      .eq("provider", provider);
    const rows = (data ?? []) as Array<{ canonical_field: string; provider_field: string }>;
    _cache.set(key, { rows, at: Date.now() });
    return rows;
  } catch {
    return [];
  }
}

/**
 * Charge l'accessor d'identifiants d'un provider : défauts du catalogue,
 * surchargés par la config utilisateur. Un provider absent du catalogue
 * fonctionne aussi (accessor vide + overrides éventuels) : un outil inconnu
 * reste mappable entièrement depuis les paramètres.
 */
export async function loadIdentifierAccessor(
  sb: SupabaseClient,
  orgId: string,
  provider: string,
): Promise<IdentifierAccessor> {
  const defs = PROVIDER_IDENTIFIERS[provider] ?? [];
  const overrides = await loadOverrides(sb, orgId, provider);

  const paths: Partial<Record<CanonicalIdentifier, string>> = {};
  const native: Partial<Record<CanonicalIdentifier, boolean>> = {};
  for (const d of defs) {
    paths[d.canonicalField] = d.defaultProviderField;
    native[d.canonicalField] = d.native;
  }
  const overridden = new Set<string>();
  for (const o of overrides) {
    if (!o.provider_field?.trim()) continue;
    paths[o.canonical_field as CanonicalIdentifier] = o.provider_field.trim();
    overridden.add(o.canonical_field);
  }

  const seen: Record<string, { present: number; total: number }> = {};

  const extract = (record: unknown): ExtractedIdentifiers => {
    const out: ExtractedIdentifiers = {};
    for (const [field, path] of Object.entries(paths) as Array<[CanonicalIdentifier, string]>) {
      const value = getByPath(record, path);
      const stat = (seen[field] ??= { present: 0, total: 0 });
      stat.total++;
      if (value) {
        stat.present++;
        out[field] = value;
      }
    }
    return out;
  };

  const coverage = (): IdentifierCoverage => {
    const out: IdentifierCoverage = {};
    for (const [field, path] of Object.entries(paths) as Array<[CanonicalIdentifier, string]>) {
      out[field] = {
        present: seen[field]?.present ?? 0,
        total: seen[field]?.total ?? 0,
        path,
        native: native[field] ?? false,
        overridden: overridden.has(field),
      };
    }
    return out;
  };

  return { provider, paths, overridden, extract, coverage };
}

// ── Audit de sync (rapport montré dans Audit qualité → Audit onboarding) ────

export type ConnectorAuditReport = {
  ran_at: string;
  /** Volumes importés par type d'entité canonique. */
  totals: Record<string, number>;
  /** Répartition des méthodes de rapprochement contact (exact_email, created…). */
  contact_match: Record<string, number>;
  /** Répartition des méthodes de rapprochement company (siren, domain, created…). */
  company_match: Record<string, number>;
  /** Records source ignorés faute d'identifiant exploitable (ex. sans email). */
  unmatched: Record<string, number>;
  /** Couverture de chaque identifiant canonique dans les payloads source. */
  identifier_coverage: IdentifierCoverage;
};

export function newAuditCounters() {
  const contact_match: Record<string, number> = {};
  const company_match: Record<string, number> = {};
  const unmatched: Record<string, number> = {};
  return {
    contact_match,
    company_match,
    unmatched,
    bumpContact(method: string) { contact_match[method] = (contact_match[method] ?? 0) + 1; },
    bumpCompany(method: string) { company_match[method] = (company_match[method] ?? 0) + 1; },
    bumpUnmatched(kind: string) { unmatched[kind] = (unmatched[kind] ?? 0) + 1; },
  };
}

/**
 * Persiste le rapport d'audit du connecteur (une ligne par org × provider,
 * écrasée à chaque sync). Silencieux si la migration n'est pas appliquée :
 * l'audit ne doit jamais faire échouer une sync.
 */
export async function recordConnectorAudit(
  sb: SupabaseClient,
  orgId: string,
  provider: string,
  report: ConnectorAuditReport,
): Promise<void> {
  try {
    await sb.from("connector_audits").upsert(
      {
        organization_id: orgId,
        provider,
        report,
        created_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,provider" },
    );
  } catch {
    // table absente (migration non appliquée) — on n'insiste pas
  }
}
