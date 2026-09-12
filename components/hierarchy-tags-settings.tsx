"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsSaveButton, useSettingsEditLock } from "@/components/settings-edit-lock";
import { TAG_COLORS, TAG_COLOR_IDS, DEFAULT_TAG_COLOR } from "@/lib/reconciliation/tag-colors";

/**
 * Paramètres → Enrichissement : TAGS DE HIÉRARCHIE — des propriétés CRM
 * personnalisées (fiches Entreprise) affichées en tags à côté des montants
 * sur la page Groupes déclarés, et utilisables en filtres pour hiérarchiser
 * les comptes (segment, tier, ICP, région…).
 *
 * MÊME SYSTÈME que l'ajout de cohortes personnalisées (rien d'inventé) :
 * même stockage (cohort_mappings, clé préfixée hiertag_, jamais montrée dans
 * les cohortes ni les filtres de rapports), même vérification de la propriété
 * dans le CRM avant enregistrement (nom API ou libellé, le nom API est
 * retrouvé), même backfill des valeurs par l'ETL après enregistrement.
 */

type Mapping = {
  key: string;
  label: string;
  internal_name: string;
  api_name: string;
  object: string;
  team: string;
  show_in_reports?: boolean;
  /** Couleur du badge sur la page Groupes déclarés (palette prédéfinie). */
  color?: string;
};

type PropState = { exists: boolean | null; label: string | null; suggestedName: string | null };

const isTag = (m: Mapping) => m.key.startsWith("hiertag_");
const MAX_TAGS = 4;

const field =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:bg-slate-50 disabled:text-slate-400";

export function HierarchyTagsSettings({ hasCrm = false }: { hasCrm?: boolean }) {
  const lock = useSettingsEditLock();
  const editing = !lock || lock.editing;

  const [rows, setRows] = useState<Mapping[] | null>(null);
  // Les AUTRES mappings (cohortes) : conservés tels quels — le POST remplace
  // la liste entière, on renvoie donc toujours cohortes + tags fusionnés.
  const othersRef = useRef<Mapping[]>([]);
  const [status, setStatus] = useState<Record<string, PropState | undefined>>({});
  const [state, setState] = useState<"idle" | "checking" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/cohort-mappings");
      const d = await res.json().catch(() => ({}));
      const all = (Array.isArray(d.mappings) ? d.mappings : []) as Mapping[];
      othersRef.current = all.filter((m) => !isTag(m));
      setRows(all.filter(isTag));
    } catch {
      setRows([]);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function patch(key: string, p: Partial<Mapping>) {
    setRows((r) => (r ?? []).map((m) => (m.key === key ? { ...m, ...p } : m)));
    if (p.internal_name !== undefined || p.api_name !== undefined) {
      setStatus((prev) => ({ ...prev, [key]: undefined }));
    }
  }
  function addRow() {
    setRows((r) => [
      ...(r ?? []),
      // Tag = propriété d'ENTREPRISE, jamais listée dans les rapports.
      { key: `hiertag_${Date.now()}`, label: "", internal_name: "", api_name: "", object: "companies", team: "", show_in_reports: false, color: DEFAULT_TAG_COLOR },
    ]);
  }
  function removeRow(key: string) {
    setRows((r) => (r ?? []).filter((m) => m.key !== key));
    setStatus((prev) => ({ ...prev, [key]: undefined }));
  }

  /** Vérifie puis enregistre — même contrat que le formulaire des cohortes. */
  async function save(): Promise<boolean> {
    if (state === "checking" || state === "saving") return false;
    setError(null);
    const tags = (rows ?? []).filter((m) => m.label.trim() && (m.internal_name.trim() || m.api_name.trim()));

    // 1. Vérification dans le CRM : la propriété doit exister SUR LES FICHES
    //    ENTREPRISE (les tags lisent la donnée des sociétés des groupes).
    setState("checking");
    let verified: Record<string, PropState> = {};
    if (hasCrm && tags.length > 0) {
      try {
        const res = await fetch("/api/settings/hubspot-properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checks: tags.map((m) => ({ objectType: "companies", name: m.api_name.trim(), label: m.internal_name.trim(), fallbackAny: false })),
          }),
        });
        if (res.ok) {
          const d = await res.json();
          const results = (d.results ?? []) as Array<{ exists: boolean | null; label: string | null; suggestedName: string | null }>;
          tags.forEach((m, i) => {
            const r = results[i];
            if (!r) return;
            if (r.exists === false && r.suggestedName) {
              // Retrouvée via son libellé → le nom API trouvé est appliqué.
              m.api_name = r.suggestedName;
              verified[m.key] = { exists: true, label: r.label, suggestedName: r.suggestedName };
            } else {
              verified[m.key] = { exists: r.exists, label: r.label, suggestedName: null };
            }
          });
          setStatus((prev) => ({ ...prev, ...verified }));
          setRows((prev) => (prev ?? []).map((m) => tags.find((t) => t.key === m.key) ?? m));
          const missing = tags.filter((m) => verified[m.key]?.exists === false);
          if (missing.length > 0) {
            setError(
              `Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} sur les fiches Entreprise HubSpot : ` +
              missing.map((m) => `« ${m.api_name.trim() || m.internal_name.trim()} »`).join(", ") +
              ". Saisis le libellé affiché dans HubSpot (Revold retrouvera le nom API), ou crée d'abord la propriété.",
            );
            setState("error");
            return false;
          }
        }
      } catch { /* CRM injoignable → enregistrement sans vérification, comme les cohortes */ }
    }

    // 2. Enregistrement : cohortes existantes + tags — la liste ENTIÈRE.
    setState("saving");
    try {
      const res = await fetch("/api/cohort-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: [...othersRef.current, ...tags] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        setState("error");
        return false;
      }
      setRows(tags);
      setState("idle");
      return true;
    } catch {
      setError("Enregistrement impossible.");
      setState("error");
      return false;
    }
  }

  const busy = state === "checking" || state === "saving";

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-900">Tags de hiérarchie (Groupes déclarés)</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Câble jusqu&apos;à {MAX_TAGS} propriétés personnalisées de tes fiches Entreprise (segment, tier, ICP,
            région…) : elles s&apos;affichent en <span className="font-medium text-slate-700">tags à côté des
            montants</span> sur la page Groupes déclarés et servent de <span className="font-medium text-slate-700">
            filtres</span> pour hiérarchiser les comptes. Même vérification que les cohortes : la propriété doit
            exister dans ton CRM.
          </p>
        </div>
        <SettingsSaveButton
          editLabel="✎ Modifier les tags"
          label={state === "checking" ? "Vérification…" : state === "saving" ? "Enregistrement…" : "Vérifier et enregistrer"}
          busy={busy}
          onSave={save}
        />
      </div>

      {error && <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {rows == null ? (
        <p className="mt-3 text-xs text-slate-400">Chargement…</p>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
              Aucun tag câblé — la page Groupes déclarés n&apos;affiche que les montants. Ajoute une propriété pour
              hiérarchiser les comptes sur ta propre donnée.
            </p>
          )}
          {rows.map((m) => {
            const st = status[m.key];
            return (
              <div key={m.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    {m.label.trim() || "Nouveau tag"}
                    {st?.exists === true && (
                      <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DANS LE CRM · Entreprise</span>
                    )}
                    {st?.exists === false && (
                      <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                    )}
                  </p>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => removeRow(m.key)}
                      className="rounded-lg px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      Retirer
                    </button>
                  )}
                </div>
                {/* Couleur du badge : palette prédéfinie (cohérence DA) — la
                    pastille sélectionnée porte un anneau + un aperçu du badge. */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-slate-600">Couleur du badge</span>
                  {TAG_COLOR_IDS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!editing}
                      title={TAG_COLORS[c].label}
                      onClick={() => patch(m.key, { color: c })}
                      className={`h-5 w-5 rounded-full ${TAG_COLORS[c].swatch} transition disabled:opacity-50 ${
                        (m.color ?? DEFAULT_TAG_COLOR) === c ? "ring-2 ring-slate-700 ring-offset-1" : "hover:scale-110"
                      }`}
                    />
                  ))}
                  {m.label.trim() && (
                    <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${TAG_COLORS[m.color ?? DEFAULT_TAG_COLOR]?.light ?? TAG_COLORS[DEFAULT_TAG_COLOR].light}`}>
                      {m.label.trim()}
                    </span>
                  )}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <label className="block text-xs font-medium text-slate-600">
                    Nom du tag (affiché)
                    <input
                      type="text"
                      value={m.label}
                      disabled={!editing}
                      onChange={(e) => patch(m.key, { label: e.target.value.slice(0, 40) })}
                      placeholder="Segment"
                      className={field}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Libellé de la propriété dans HubSpot
                    <input
                      type="text"
                      value={m.internal_name}
                      disabled={!editing}
                      onChange={(e) => patch(m.key, { internal_name: e.target.value })}
                      placeholder="Segment client"
                      className={field}
                    />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Nom API (retrouvé via le libellé si vide)
                    <input
                      type="text"
                      value={m.api_name}
                      disabled={!editing}
                      onChange={(e) => patch(m.key, { api_name: e.target.value })}
                      placeholder="segment_client"
                      className={`${field} font-mono`}
                    />
                  </label>
                </div>
              </div>
            );
          })}
          {editing && rows.length < MAX_TAGS && (
            <button
              type="button"
              onClick={addRow}
              className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-fuchsia-300 hover:text-fuchsia-700"
            >
              ＋ Ajouter une propriété d&apos;entreprise
            </button>
          )}
          {!hasCrm && (
            <p className="text-[11px] text-amber-700">
              HubSpot n&apos;est pas connecté : la vérification des propriétés est impossible — connecte ton CRM d&apos;abord.
            </p>
          )}
          <p className="text-[11px] text-slate-400">
            Après enregistrement, les valeurs sont importées au prochain passage de la synchronisation (comme pour les
            cohortes) — les tags apparaissent ensuite sur la page Groupes déclarés.
          </p>
        </div>
      )}
    </div>
  );
}
