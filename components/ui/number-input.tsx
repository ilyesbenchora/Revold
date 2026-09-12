"use client";

/**
 * Champ de saisie NUMÉRIQUE avec séparateurs de milliers à la française
 * (1 000, 1 000 000, 1 000 000 000…) et décimales. La valeur remontée par
 * `onChange` reste une chaîne numérique BRUTE (sans espaces, point décimal) —
 * `Number(value)` fonctionne directement en aval.
 *
 * Utilisé pour les seuils d'alerte (classiques & techniques) et les cibles
 * d'objectif : un champ plus large, lisible dès qu'on passe au millier.
 */

// Espace fine insécable (comme Intl.NumberFormat fr-FR) pour grouper les milliers.
const THIN = " ";

/** Valeur brute (« 1234567.5 ») → affichage groupé (« 1 234 567,5 »). */
function format(raw: string): string {
  if (!raw) return "";
  const neg = raw.startsWith("-");
  const body = neg ? raw.slice(1) : raw;
  const [int, dec] = body.split(".");
  const grouped = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
  const out = dec != null ? `${grouped},${dec}` : grouped;
  return neg ? `-${out}` : out;
}

/** Saisie affichée → valeur brute (chiffres + un seul point décimal). */
function parse(display: string): string {
  let s = display.replace(/[^\d.,-]/g, "").replace(/,/g, ".");
  const neg = s.startsWith("-");
  s = s.replace(/-/g, "");
  const parts = s.split(".");
  s = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : s;
  return neg ? `-${s}` : s;
}

export function NumberInput({
  value,
  onChange,
  className = "",
  placeholder,
  id,
  required,
  disabled,
  onKeyDown,
}: {
  /** Valeur brute (chaîne numérique sans séparateur). */
  value: string;
  onChange: (raw: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={format(value)}
      onChange={(e) => onChange(parse(e.target.value))}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={`tabular-nums ${className}`}
    />
  );
}
