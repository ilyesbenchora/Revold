/**
 * Affiche une valeur KPI en respectant son statut diagnostic.
 *
 *  - status "ok"            → la valeur formatée (ou fallback "—" si 0 et hideZero)
 *  - status "no_scope"      → "—" + tooltip "Scope OAuth manquant"
 *  - status "addon_missing" → "—" + tooltip "Hub HubSpot non activé"
 *  - status "bad_property"  → "—" + tooltip "Propriété inexistante dans votre CRM"
 *  - status "endpoint_error" / "network_error" → "—" + tooltip technique
 *
 * On NE camoufle PLUS un échec API en affichant 0 — c'est ça qui faisait
 * croire à l'utilisateur que ses données étaient vides.
 */

import type { KpiDiagnosticEntry } from "@/lib/integrations/hubspot-snapshot";

type Props = {
  value: number;
  status?: KpiDiagnosticEntry;
  /** Format de rendu (par défaut: locale FR). */
  format?: (n: number) => string;
  /** Texte de fallback affiché à la place de la valeur (par défaut "—"). */
  fallback?: string;
  /** Classe Tailwind appliquée à la valeur. */
  className?: string;
};

const STATUS_LABEL: Record<NonNullable<KpiDiagnosticEntry>["status"], string> = {
  ok: "Donnée à jour",
  no_scope: "Scope OAuth manquant — autorisez Revold à lire cet objet HubSpot",
  addon_missing: "Hub HubSpot non activé sur votre portail (Service Hub / Invoicing / etc.)",
  bad_property: "Propriété inexistante dans votre CRM — créez-la ou contactez Revold",
  endpoint_error: "Erreur HubSpot lors du calcul de cette donnée",
  network_error: "Erreur réseau — la donnée n'a pas pu être récupérée",
};

export function KpiValue({ value, status, format, fallback = "—", className = "" }: Props) {
  const isUnavailable = status && status.status !== "ok";
  if (isUnavailable) {
    const tooltip = STATUS_LABEL[status.status];
    return (
      <span
        className={`tabular-nums text-slate-300 cursor-help ${className}`}
        title={`${tooltip}${status.detail ? ` (${status.detail})` : ""}`}
      >
        {fallback}
      </span>
    );
  }
  const formatted = format ? format(value) : value.toLocaleString("fr-FR");
  return <span className={`tabular-nums ${className}`}>{formatted}</span>;
}

/**
 * Helper : déduit le statut combiné d'un KPI dérivé de plusieurs sources.
 * Si l'une est en erreur, le combiné est en erreur (le pire prime).
 */
export function combineKpiStatus(
  ...statuses: Array<KpiDiagnosticEntry | undefined>
): KpiDiagnosticEntry | undefined {
  const order: Array<NonNullable<KpiDiagnosticEntry>["status"]> = [
    "network_error",
    "endpoint_error",
    "bad_property",
    "addon_missing",
    "no_scope",
    "ok",
  ];
  let worst: KpiDiagnosticEntry | undefined;
  for (const s of statuses) {
    if (!s) continue;
    if (!worst) {
      worst = s;
      continue;
    }
    if (order.indexOf(s.status) < order.indexOf(worst.status)) worst = s;
  }
  return worst;
}
