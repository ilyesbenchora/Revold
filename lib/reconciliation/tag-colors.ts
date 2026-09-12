/**
 * Palette des TAGS DE HIÉRARCHIE (Paramètres → Enrichissement) : couleurs
 * prédéfinies de la DA (jamais de couleur libre — cohérence des badges).
 * `light` = badge sur fond clair (filiales), `dark` = badge sur le bandeau
 * indigo de la holding, `swatch` = pastille du nuancier dans les réglages.
 */
export const TAG_COLORS: Record<string, { label: string; light: string; dark: string; swatch: string }> = {
  slate: { label: "Gris", light: "bg-slate-200/70 text-slate-600", dark: "bg-white/25 text-white", swatch: "bg-slate-400" },
  indigo: { label: "Indigo", light: "bg-indigo-100 text-indigo-700", dark: "bg-indigo-400/80 text-white", swatch: "bg-indigo-500" },
  emerald: { label: "Vert", light: "bg-emerald-100 text-emerald-700", dark: "bg-emerald-400/90 text-emerald-950", swatch: "bg-emerald-500" },
  amber: { label: "Ambre", light: "bg-amber-100 text-amber-700", dark: "bg-amber-300/90 text-amber-950", swatch: "bg-amber-400" },
  rose: { label: "Rose", light: "bg-rose-100 text-rose-700", dark: "bg-rose-400/90 text-white", swatch: "bg-rose-500" },
  fuchsia: { label: "Fuchsia", light: "bg-fuchsia-100 text-fuchsia-700", dark: "bg-fuchsia-400/90 text-white", swatch: "bg-fuchsia-500" },
  sky: { label: "Bleu ciel", light: "bg-sky-100 text-sky-700", dark: "bg-sky-300/90 text-sky-950", swatch: "bg-sky-400" },
  violet: { label: "Violet", light: "bg-violet-100 text-violet-700", dark: "bg-violet-400/90 text-white", swatch: "bg-violet-500" },
};

export const TAG_COLOR_IDS = Object.keys(TAG_COLORS);
export const DEFAULT_TAG_COLOR = "slate";

export function tagColorClasses(color: string | undefined, dark: boolean): string {
  const c = TAG_COLORS[color ?? DEFAULT_TAG_COLOR] ?? TAG_COLORS[DEFAULT_TAG_COLOR];
  return dark ? c.dark : c.light;
}
