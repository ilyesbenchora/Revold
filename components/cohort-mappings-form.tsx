"use client";

import { SettingsSaveButton } from "@/components/settings-edit-lock";
import { useState } from "react";
import { COHORT_TEAMS, STANDARD_COHORT_TEAMS, type CohortRight } from "@/lib/settings/cohort-teams";

export type CohortMapping = {
  key: string;
  label: string;
  internal_name: string;
  api_name: string;
  /** Objet HubSpot porteur de la propriété (contacts/companies/deals) — "" = détection auto. */
  object: string;
  /** Équipe propriétaire de la cohorte (sales/marketing/cs/finance) — "" = transverse (toutes). */
  team: string;
};

/** État de vérification d'une propriété CRM d'une cohorte. */
export type CohortPropertyState = {
  /** true = présente dans le CRM · false = absente · null = invérifiable. */
  exists: boolean | null;
  /** Libellé réel de la propriété quand elle a été trouvée. */
  label: string | null;
  /** Nom API retrouvé via le libellé quand le nom saisi n'existait pas. */
  suggestedName: string | null;
  /** Objet CRM où la propriété a été trouvée (contacts/companies/deals). */
  foundObject: string | null;
};

/** Statut par cohorte (clé = key du mapping). */
export type CohortPropertyStatus = Record<string, CohortPropertyState | undefined>;

/** Droits du membre courant sur chaque groupe d'équipe (calculés côté serveur). */
export type CohortTeamRights = Record<string, Record<CohortRight, boolean>>;

const UNVERIFIED: CohortPropertyState = { exists: null, label: null, suggestedName: null, foundObject: null };

const OBJECT_LABELS: Record<string, string> = { contacts: "Contact", companies: "Entreprise", deals: "Deal" };

/** Options du sélecteur « Objet HubSpot » ("" = on cherche sur les 3 objets). */
const OBJECT_OPTIONS: { id: string; label: string }[] = [
  { id: "contacts", label: "Contact" },
  { id: "companies", label: "Entreprise" },
  { id: "deals", label: "Deal" },
  { id: "", label: "Détection auto (tous les objets)" },
];

/** Sections STANDARD — toujours affichées, non supprimables. `object` = objet HubSpot par défaut. */
export const STANDARD_COHORTS: { key: string; label: string; hint: string; object: string }[] = [
  { key: "industry", label: "Secteur d'activité", hint: "La propriété CRM qui porte l'industrie / le secteur", object: "companies" },
  { key: "segment", label: "Segment", hint: "PME / ETI / Enterprise, tiers, ICP…", object: "companies" },
  { key: "source", label: "Sources (canal d'acquisition)", hint: "Origine du contact / deal : inbound, outbound, paid…", object: "contacts" },
];

/** Cohortes standard RETIRÉES : les enregistrements legacy sont ignorés au chargement. */
const REMOVED_COHORT_KEYS = new Set(["priority"]);

/** Groupes affichés : les 4 équipes puis les cohortes transverses (toutes équipes). */
const GROUPS: { id: string; label: string; icon: string }[] = [
  ...COHORT_TEAMS,
  { id: "", label: "Toutes les équipes", icon: "🌐" },
];

/**
 * Paramètres → Cohortes : pour chaque axe marketing/vente, le NOM DE LA
 * PROPRIÉTÉ dans le CRM (nom interne) et son NOM API — souvent des propriétés
 * custom selon les bases. Les cohortes sont GROUPÉES PAR ÉQUIPE (Ventes,
 * Marketing, Service client, Comptabilité, transverses) : chaque membre ne
 * voit que les groupes que ses droits autorisent (matrice « Cohortes par
 * équipe » d'Utilisateurs & équipes) — l'admin voit tout.
 * Même système de vérification que le mapping des identifiants : propriétés
 * vérifiées dans le CRM connecté avant enregistrement.
 */
export function CohortMappingsForm({
  initial,
  initialStatus = {},
  hasCrm = false,
  teamRights,
  salesExtra,
}: {
  initial: CohortMapping[];
  /** Statut initial (serveur) des propriétés, clé = key du mapping. */
  initialStatus?: CohortPropertyStatus;
  /** true si un CRM est connecté (token dispo) — sinon vérification impossible. */
  hasCrm?: boolean;
  /** Droits du membre courant par équipe (clé = team id) — admin : tout à true. */
  teamRights: CohortTeamRights;
  /** Bloc supplémentaire rendu DANS le groupe Ventes (ex : cohorte Contrat — dates de début/fin). */
  salesExtra?: React.ReactNode;
}) {
  // État initial : sections standard (pré-remplies si déjà enregistrées) + customs.
  // IMPORTANT : l'état contient TOUTES les cohortes, y compris celles des
  // groupes masqués — l'enregistrement renvoie tout, rien n'est perdu.
  const [rows, setRows] = useState<CohortMapping[]>(() => {
    const byKey = new Map(initial.map((m) => [m.key, m]));
    const std = STANDARD_COHORTS.map((s) => {
      const saved = byKey.get(s.key);
      const defaultTeam = STANDARD_COHORT_TEAMS[s.key] ?? "";
      return saved
        ? { ...saved, object: saved.object || s.object, team: saved.team ?? defaultTeam }
        : { key: s.key, label: s.label, internal_name: "", api_name: "", object: s.object, team: defaultTeam };
    });
    const customs = initial
      .filter((m) => !STANDARD_COHORTS.some((s) => s.key === m.key) && !REMOVED_COHORT_KEYS.has(m.key))
      .map((m) => ({ ...m, object: m.object ?? "", team: m.team ?? "" }));
    return [...std, ...customs];
  });
  const [status, setStatus] = useState<CohortPropertyStatus>(initialStatus);
  const [state, setState] = useState<"idle" | "checking" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const isStandard = (key: string) => STANDARD_COHORTS.some((s) => s.key === key);
  const hintFor = (key: string) => STANDARD_COHORTS.find((s) => s.key === key)?.hint;

  const canView = (team: string) => (team === "" ? true : (teamRights[team]?.view ?? false));
  const canEdit = (team: string) =>
    team === ""
      ? GROUPS.some((g) => g.id && teamRights[g.id]?.edit)
      : (teamRights[team]?.edit ?? false);
  const canCreate = (team: string) =>
    team === ""
      ? GROUPS.some((g) => g.id && teamRights[g.id]?.create)
      : (teamRights[team]?.create ?? false);
  const anyEditable = GROUPS.some((g) => canEdit(g.id));

  function patch(key: string, p: Partial<CohortMapping>) {
    setRows((r) => r.map((m) => (m.key === key ? { ...m, ...p } : m)));
    // La saisie a changé : le statut vérifié ne vaut plus pour cette cohorte.
    if (p.internal_name !== undefined || p.api_name !== undefined || p.object !== undefined) {
      setStatus((prev) => ({ ...prev, [key]: UNVERIFIED }));
    }
  }

  function addCustom(team: string) {
    const n = rows.filter((r) => !isStandard(r.key)).length + 1;
    setRows((r) => [...r, { key: `custom_${Date.now()}`, label: `Cohorte custom ${n}`, internal_name: "", api_name: "", object: "contacts", team }]);
  }

  function removeRow(key: string) {
    setRows((r) => r.filter((x) => x.key !== key));
    setStatus((prev) => ({ ...prev, [key]: undefined }));
  }

  /**
   * Vérifie dans le CRM connecté que les propriétés saisies existent SUR
   * L'OBJET CHOISI (nom API, puis libellé). Nom API faux mais libellé connu →
   * le nom API trouvé est appliqué ; propriété sur un AUTRE objet (fallback) →
   * l'objet est corrigé aussi.
   */
  async function verifyProperties(
    filled: CohortMapping[],
  ): Promise<{ status: CohortPropertyStatus; corrected: Record<string, Partial<CohortMapping>> } | null> {
    if (!hasCrm || filled.length === 0) return { status: {}, corrected: {} };
    try {
      const res = await fetch("/api/settings/hubspot-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checks: filled.map((m) => ({
            objectType: m.object.trim() || "any",
            name: m.api_name.trim(),
            label: m.internal_name.trim(),
            fallbackAny: true,
          })),
        }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const results = (d.results ?? []) as Array<{
        exists: boolean | null; label: string | null; suggestedName: string | null; foundObject: string | null;
      }>;
      const nextStatus: CohortPropertyStatus = {};
      const corrected: Record<string, Partial<CohortMapping>> = {};
      // Les résultats sont renvoyés dans le même ordre que les checks.
      filled.forEach((m, i) => {
        const r = results[i];
        if (!r) {
          nextStatus[m.key] = UNVERIFIED;
          return;
        }
        // Trouvée sur un autre objet que celui choisi → l'objet est corrigé.
        const fix: Partial<CohortMapping> = {};
        if (r.foundObject && m.object && r.foundObject !== m.object) fix.object = r.foundObject;
        if (r.exists === false && r.suggestedName) {
          // Propriété retrouvée via son libellé → on applique son nom API.
          fix.api_name = r.suggestedName;
          nextStatus[m.key] = { exists: true, label: r.label, suggestedName: r.suggestedName, foundObject: r.foundObject ?? (m.object || null) };
        } else {
          nextStatus[m.key] = { exists: r.exists, label: r.label, suggestedName: null, foundObject: r.foundObject ?? (r.exists === true ? m.object || null : null) };
        }
        if (Object.keys(fix).length > 0) corrected[m.key] = fix;
      });
      setRows((prev) => prev.map((m) => (corrected[m.key] ? { ...m, ...corrected[m.key] } : m)));
      setStatus((prev) => ({ ...prev, ...nextStatus }));
      return { status: nextStatus, corrected };
    } catch {
      return null;
    }
  }

  /** Vérifie puis enregistre — retourne false en cas d'échec (le verrou reste en édition). */
  async function save(): Promise<boolean> {
    if (state === "checking" || state === "saving") return false;
    setError(null);

    // On n'enregistre que les lignes renseignées (au moins un des deux noms).
    const mappings = rows.filter((m) => m.internal_name.trim() || m.api_name.trim() || !isStandard(m.key));

    // 1. Revold vérifie dans le CRM que les propriétés saisies existent bien —
    //    on n'enregistre pas un mapping qui pointe vers le vide. Seuls les
    //    groupes éditables sont vérifiés (les autres sont hors de portée).
    setState("checking");
    const filled = mappings.filter((m) => (m.internal_name.trim() || m.api_name.trim()) && canEdit(m.team));
    const verified = await verifyProperties(filled);
    if (verified) {
      const missing = filled
        .filter((m) => verified.status[m.key]?.exists === false)
        .map((m) => `« ${m.api_name.trim() || m.internal_name.trim()} » (${m.label}${m.object ? ` · objet ${OBJECT_LABELS[m.object] ?? m.object}` : ""})`);
      if (missing.length > 0) {
        setError(
          `Propriété${missing.length > 1 ? "s" : ""} introuvable${missing.length > 1 ? "s" : ""} dans HubSpot : ${missing.join(", ")}. ` +
          "Vérifiez l'objet et le nom API (ou saisissez le libellé affiché dans HubSpot : Revold retrouvera le nom API), " +
          "ou créez d'abord la propriété dans HubSpot, puis réenregistrez.",
        );
        setState("error");
        return false;
      }
    }

    // 2. Enregistrement — les noms API corrigés par la vérification priment
    //    sur l'état local, qui peut ne pas avoir encore re-rendu.
    setState("saving");
    try {
      const payload = mappings.map((m) => (verified?.corrected[m.key] ? { ...m, ...verified.corrected[m.key] } : m));
      const res = await fetch("/api/cohort-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: payload }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Enregistrement impossible.");
        setState("error");
        return false;
      }
      setState("done");
      setTimeout(() => setState("idle"), 2500);
      return true;
    } catch {
      setError("Enregistrement impossible.");
      setState("error");
      return false;
    }
  }

  const field =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-fuchsia-300 focus:ring-2 focus:ring-fuchsia-100 disabled:bg-slate-50 disabled:text-slate-400";

  const renderRow = (m: CohortMapping, editable: boolean) => {
    const st = status[m.key];
    return (
      <div key={m.key} className="rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-2">
          {isStandard(m.key) ? (
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                {m.label}
                {st?.exists === true && (
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                    ✓ DANS LE CRM{st.foundObject ? ` · ${OBJECT_LABELS[st.foundObject] ?? st.foundObject}` : ""}
                  </span>
                )}
                {st?.exists === false && (
                  <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
                )}
              </p>
              {hintFor(m.key) && <p className="text-[11px] text-slate-400">{hintFor(m.key)}</p>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                value={m.label}
                onChange={(e) => patch(m.key, { label: e.target.value })}
                placeholder="Nom de la cohorte custom"
                disabled={!editable}
                className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-fuchsia-300 disabled:bg-slate-50 disabled:text-slate-400"
              />
              {st?.exists === true && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                  ✓ DANS LE CRM{st.foundObject ? ` · ${OBJECT_LABELS[st.foundObject] ?? st.foundObject}` : ""}
                </span>
              )}
              {st?.exists === false && (
                <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">⚠ ABSENTE DU CRM</span>
              )}
            </div>
          )}
          {!isStandard(m.key) && editable && (
            <button
              type="button"
              onClick={() => removeRow(m.key)}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-slate-400 hover:bg-rose-50 hover:text-rose-500"
            >
              Supprimer
            </button>
          )}
        </div>
        {/* Pas de champ « Équipe » : le groupe qui contient la cohorte porte
            déjà l'équipe — le partage passe par « Toutes les équipes ». */}
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Objet HubSpot</label>
            <select
              value={m.object}
              onChange={(e) => patch(m.key, { object: e.target.value })}
              disabled={!editable}
              className={field}
            >
              {OBJECT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom de la propriété (interne)</label>
            <input
              value={m.internal_name}
              onChange={(e) => patch(m.key, { internal_name: e.target.value })}
              placeholder="Ex : Secteur d'activité principal"
              disabled={!editable}
              className={field}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Nom API</label>
            <input
              value={m.api_name}
              onChange={(e) => patch(m.key, { api_name: e.target.value })}
              placeholder="Ex : secteur_activite_principal"
              disabled={!editable}
              className={`${field} ${st?.exists === false ? "border-rose-300" : ""}`}
            />
          </div>
        </div>
      </div>
    );
  };

  const visibleGroups = GROUPS.filter((g) => canView(g.id));

  return (
    <div className="space-y-5">
      {!hasCrm && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Aucun CRM connecté : les propriétés ne peuvent pas être vérifiées. Connectez votre CRM pour que Revold
          contrôle leur existence avant enregistrement.
        </p>
      )}

      {visibleGroups.map((g) => {
        const groupRows = rows.filter((m) => (m.team || "") === g.id);
        // Groupe transverse vide et non créable : rien à montrer.
        if (g.id === "" && groupRows.length === 0 && !canCreate("")) return null;
        const editable = canEdit(g.id);
        // La cohorte Contrat (salesExtra) compte dans le badge du groupe Ventes.
        const cohortCount = groupRows.length + (g.id === "sales" && salesExtra ? 1 : 0);
        return (
          <div key={g.id || "all"} className="card p-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {g.label}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {cohortCount} cohorte{cohortCount > 1 ? "s" : ""}
                  </span>
                </h3>
                {!editable && (
                  <p className="mt-0.5 text-[11px] text-slate-400">Lecture seule — droits gérés dans Utilisateurs &amp; équipes.</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {/* Reprendre une cohorte DÉJÀ enregistrée dans un autre groupe
                    (sans la retaper) : vers « Toutes les équipes » elle devient
                    transverse ; vers une équipe, elle rejoint son périmètre. */}
                {editable && (() => {
                  const candidates = rows.filter((m) => (m.team || "") !== g.id && canView(m.team || ""));
                  if (candidates.length === 0) return null;
                  return (
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) patch(e.target.value, { team: g.id }); }}
                      title={
                        g.id === ""
                          ? "Rendre une cohorte existante visible par toutes les équipes"
                          : `Reprendre une cohorte d'un autre groupe dans ${g.label}`
                      }
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 outline-none focus:border-fuchsia-300"
                    >
                      <option value="">↪ Reprendre une cohorte existante…</option>
                      {candidates.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label} ({GROUPS.find((g2) => g2.id === (m.team || ""))?.label ?? m.team})
                        </option>
                      ))}
                    </select>
                  );
                })()}
                {canCreate(g.id) && (
                  <button
                    type="button"
                    onClick={() => addCustom(g.id)}
                    className="rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-semibold text-fuchsia-700 transition hover:bg-fuchsia-100"
                  >
                    ＋ Ajouter une cohorte custom
                  </button>
                )}
              </div>
            </div>
            {groupRows.length === 0 && !(g.id === "sales" && salesExtra) ? (
              <p className="text-xs text-slate-400">Aucune cohorte dans ce groupe pour l&apos;instant.</p>
            ) : (
              <div className="space-y-4">{groupRows.map((m) => renderRow(m, editable))}</div>
            )}
            {/* Cohorte Contrat (dates de début/fin) — rendue dans le groupe Ventes. */}
            {g.id === "sales" && salesExtra && <div className="mt-4">{salesExtra}</div>}
          </div>
        );
      })}

      {anyEditable && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {state === "done" && <span className="text-xs font-semibold text-emerald-600">✓ Vérifié et enregistré</span>}
          {state === "error" && <span className="text-xs text-rose-500">{error}</span>}
          {/* CTA UNIQUE : « ✎ Modifier les cohortes » (verrouillé) ↔ « Enregistrer les cohortes ». */}
          <SettingsSaveButton
            editLabel="✎ Modifier les cohortes"
            label={state === "checking" ? "Vérification CRM…" : state === "saving" ? "Enregistrement…" : "Enregistrer les cohortes"}
            busy={state === "checking" || state === "saving"}
            onSave={save}
          />
        </div>
      )}
    </div>
  );
}
