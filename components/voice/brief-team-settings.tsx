"use client";

/**
 * Brief PERSONNALISÉ par équipe — Paramètres → Tour de contrôle → Brief du jour.
 *
 * Parcours (tout est enregistré dans les réglages du compte au fil de l'eau,
 * SAUF ce qui exige une vérification préalable) :
 *  1. Équipe : admin → choix libre ; membre → son pôle, présélectionné.
 *  2. (Ventes) Pipelines inclus dans le brief.
 *  3. Suggestions de l'équipe : cases à cocher + options (périodes en
 *     multi-cases, seuil de stagnation, propriété de date des prévisions).
 *  4. Propriétés CRM personnalisées (date de fermeture / suivi) : vérifiées
 *     dans le CRM (existence, type, rapprochement) AVANT d'être enregistrées.
 *  5. Suggestions personnalisées dérivées de ces propriétés : chacune est
 *     calculée sur les vraies données (phrase exacte du brief) et n'entre dans
 *     le brief qu'après validation.
 *  6. Activation dans le brief du jour (l'écoute se fait depuis l'orbe de la
 *     home, pas d'aperçu en doublon ici).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { readTowerSettings, writeTowerSettings } from "@/lib/voice/tower-settings";
import { supportedOwnerObjects } from "@/lib/crm/owner-scope";
import {
  BRIEF_PERIODS,
  BRIEF_PROPERTY_ROLE_LABELS,
  BRIEF_TEAMS,
  CRM_OBJECT_LABELS,
  TEAM_BLOCKS,
  TEAM_OBJECTS,
  activeBlockCount,
  briefTeamLabel,
  defaultBlockConfig,
  defaultOwnerObject,
  emptyTeamConfig,
  isDateProperty,
  periodsFor,
  roleNeedsDate,
  suggestionsForProperty,
  type BriefBlockDef,
  type BriefPropertyRole,
  type BriefCrmObject,
  type BriefCustomProperty,
  type BriefCustomSuggestion,
  type BriefPeriod,
  type BriefTeamConfig,
  type BriefTeamId,
  type BriefTeamSettings,
} from "@/lib/voice/brief-team";

type Options = {
  me: { role: string | null; pole: BriefTeamId | null; isAdmin: boolean };
  crmLabel: string | null;
  hasToken: boolean;
  pipelines: { id: string; label: string }[];
  owners: { id: string; name: string }[];
};

/** Objet HubSpot porteur du propriétaire filtré (owner_id / hubspot_owner_id). */
const OWNER_PROP: Record<BriefCrmObject, string> = {
  deals: "hubspot_owner_id",
  contacts: "hubspot_owner_id",
  companies: "hubspot_owner_id",
  tickets: "hubspot_owner_id",
};

const btnPrimary = "rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50";
const btnGhost = "text-[11px] text-slate-400 hover:text-slate-600";
const input = "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-accent";

function PeriodPicker({
  allowed,
  value,
  onChange,
}: {
  allowed: BriefPeriod[];
  value: BriefPeriod[];
  onChange: (next: BriefPeriod[]) => void;
}) {
  if (allowed.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium text-slate-500">Période d&apos;analyse :</span>
      {BRIEF_PERIODS.filter((p) => allowed.includes(p.id)).map((p) => {
        const on = value.includes(p.id);
        return (
          <label
            key={p.id}
            className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${
              on ? "border-accent/50 bg-accent/10 text-slate-800" : "border-slate-200 bg-white text-slate-500 hover:border-accent/30"
            }`}
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => onChange(e.target.checked ? [...value, p.id] : value.filter((x) => x !== p.id))}
              className="h-3 w-3 accent-[var(--accent)]"
            />
            {p.label}
          </label>
        );
      })}
    </div>
  );
}

/** Sélecteur de la propriété de date des blocs de PRÉVISION (closedate ou personnalisée). */
function DatePropertyPicker({
  value,
  customProps,
  onChange,
}: {
  value: string | null | undefined;
  customProps: BriefCustomProperty[];
  onChange: (next: string | null) => void;
}) {
  const dateProps = customProps.filter((p) => p.object === "deals" && (p.role === "close_date" || isDateProperty(p)));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-medium text-slate-500">Date utilisée pour la prévision :</span>
      <select value={value ?? "closedate"} onChange={(e) => onChange(e.target.value === "closedate" ? null : e.target.value)} className={input}>
        <option value="closedate">Date de fermeture (closedate)</option>
        {dateProps.map((p) => (
          <option key={p.name} value={p.name}>{p.label} ({p.name})</option>
        ))}
      </select>
      {dateProps.length === 0 && (
        <span className="text-[10px] text-slate-400">Ajoute une propriété « date de fermeture » ci-dessous pour la choisir ici.</span>
      )}
    </div>
  );
}

/** Ajout d'une propriété CRM personnalisée : vérifiée (existence, type, rapprochement) avant enregistrement. */
function AddCustomProperty({
  team,
  hasToken,
  crmLabel,
  onAdd,
}: {
  team: BriefTeamId;
  hasToken: boolean;
  crmLabel: string | null;
  onAdd: (p: BriefCustomProperty) => void;
}) {
  const objects = TEAM_OBJECTS[team];
  const [open, setOpen] = useState(false);
  const [object, setObject] = useState<BriefCrmObject>(objects[0]);
  const [name, setName] = useState("");
  const [role, setRole] = useState<BriefPropertyRole>(team === "sales" || team === "finance" ? "close_date" : "tracking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<BriefCustomProperty | null>(null);

  useEffect(() => { setObject(objects[0]); }, [team]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    setOpen(false); setName(""); setVerified(null); setError(null);
  }

  async function verify() {
    if (loading || !name.trim()) return;
    setLoading(true); setError(null); setVerified(null);
    try {
      const res = await fetch("/api/voice/brief-team/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "property", object, name: name.trim(), label: name.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "Vérification impossible.");
      setVerified({
        name: d.name,
        label: d.label ?? d.name,
        object,
        fieldType: d.fieldType ?? null,
        type: d.type ?? null,
        role,
        coverage: d.coverage ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 w-full rounded-md border border-dashed border-accent/40 bg-white px-2.5 py-2 text-[11px] font-semibold text-accent transition hover:bg-indigo-50/40">
        ＋ Ajouter une propriété du CRM (vérifiée avant enregistrement)
      </button>
    );
  }
  const typeLabel = verified
    ? isDateProperty(verified) ? "date" : verified.type === "enumeration" ? "liste déroulante" : verified.type === "number" ? "nombre" : verified.type === "bool" ? "case à cocher" : "texte"
    : null;
  return (
    <div className="mt-2 rounded-md border border-dashed border-accent/40 bg-white p-2.5">
      <p className="text-[11px] font-semibold text-accent">Propriété du CRM à inclure</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Nom API ou libellé HubSpot — Revold vérifie qu&apos;elle existe, lit son type et compte les fiches qui la renseignent avant de l&apos;enregistrer.
      </p>
      {!hasToken && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">Aucun CRM connecté : la propriété ne peut pas être vérifiée.</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <select value={object} onChange={(e) => { setObject(e.target.value as BriefCrmObject); setVerified(null); }} className={input}>
          {objects.map((o) => <option key={o} value={o}>{CRM_OBJECT_LABELS[o]}</option>)}
        </select>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setVerified(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
          placeholder="Ex : date_signature_prevue ou « Date de signature prévue »"
          className={`${input} min-w-0 flex-1`}
        />
        <select value={role} onChange={(e) => { setRole(e.target.value as BriefPropertyRole); setVerified((v) => (v ? { ...v, role: e.target.value as BriefPropertyRole } : v)); }} className={input}>
          <option value="close_date">Fait office de date de fermeture</option>
          <option value="tracking">Suivi important</option>
          <option value="billing_start">Fait office de date de début de facturation</option>
          <option value="billing_end">Fait office de date de fin de facturation</option>
        </select>
        <button type="button" onClick={verify} disabled={loading || !name.trim() || !hasToken} className={btnPrimary}>
          {loading ? "Vérification…" : "Vérifier"}
        </button>
        <button type="button" onClick={reset} className={btnGhost}>Annuler</button>
      </div>
      {error && <p className="mt-1.5 rounded bg-rose-50 px-2 py-1.5 text-[10px] text-rose-600">{error}</p>}
      {verified && (
        <div className="mt-2 rounded-md border border-accent/30 bg-indigo-50/40 p-2">
          <p className="text-[11px] text-slate-700">
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ DANS LE CRM{crmLabel ? ` · ${crmLabel}` : ""}</span>{" "}
            <span className="font-semibold">{verified.label}</span> <span className="text-slate-500">({verified.name})</span> · {CRM_OBJECT_LABELS[verified.object]} · type {typeLabel}
            {verified.coverage && (
              <>
                {" "}·{" "}
                <span className={verified.coverage.withValue > 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
                  rapprochement : {verified.coverage.withValue} sur {verified.coverage.total} {CRM_OBJECT_LABELS[verified.object].toLowerCase()} renseignés
                </span>
              </>
            )}
          </p>
          {roleNeedsDate(verified.role) && !isDateProperty(verified) && (
            <p className="mt-1 text-[10px] text-amber-700">
              Cette propriété n&apos;est pas une date : elle ne pourra pas servir de{" "}
              {BRIEF_PROPERTY_ROLE_LABELS[verified.role]}.
            </p>
          )}
          <div className="mt-1.5 flex justify-end">
            <button type="button" onClick={() => { onAdd({ ...verified, role }); reset(); }} className={btnPrimary}>
              ✓ Valider — enregistrer la propriété
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Suggestion personnalisée proposée : calculée (rapprochement) puis validée. */
function ProposedSuggestion({
  team,
  cfg,
  proposal,
  onAdd,
}: {
  team: BriefTeamId;
  cfg: BriefTeamConfig;
  proposal: Omit<BriefCustomSuggestion, "id" | "enabled" | "coverage">;
  onAdd: (s: BriefCustomSuggestion) => void;
}) {
  const [periods, setPeriods] = useState<BriefPeriod[]>(proposal.periods);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ sentences: string[]; count: number; total: number | null; live: boolean } | null>(null);
  const allowed: BriefPeriod[] = proposal.kind === "date_window" ? BRIEF_PERIODS.map((p) => p.id) : [];

  async function verify() {
    if (loading) return;
    setLoading(true); setError(null); setPreview(null);
    try {
      const res = await fetch("/api/voice/brief-team/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "suggestion",
          team,
          config: { pipelines: cfg.pipelines, customProperties: cfg.customProperties },
          suggestion: { ...proposal, id: "preview", enabled: true, periods },
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "Calcul impossible.");
      setPreview({ sentences: d.sentences ?? [], count: d.count ?? 0, total: d.total ?? null, live: !!d.live });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white p-2">
      <p className="text-xs font-medium text-slate-800">{proposal.label}</p>
      <p className="text-[10px] text-slate-500">Suggestion personnalisée · propriété « {proposal.propertyLabel} » · {CRM_OBJECT_LABELS[proposal.object]}</p>
      <PeriodPicker allowed={allowed} value={periods} onChange={(v) => { setPeriods(v); setPreview(null); }} />
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={verify} disabled={loading || (allowed.length > 0 && periods.length === 0)} className={btnPrimary}>
          {loading ? "Rapprochement…" : "Vérifier sur mes données"}
        </button>
        {allowed.length > 0 && periods.length === 0 && <span className="text-[10px] text-slate-400">Coche au moins une période.</span>}
      </div>
      {error && <p className="mt-1.5 rounded bg-rose-50 px-2 py-1.5 text-[10px] text-rose-600">{error}</p>}
      {preview && (
        <div className="mt-2 rounded-md border border-accent/30 bg-indigo-50/40 p-2">
          <p className="text-[10px] font-semibold text-slate-600">Ce que le brief dira :</p>
          {preview.sentences.map((s, i) => <p key={i} className="mt-0.5 text-[11px] italic text-slate-700">« {s} »</p>)}
          <p className="mt-1 text-[10px]">
            <span className={preview.count > 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
              {preview.count} fiche{preview.count > 1 ? "s" : ""} rapprochée{preview.count > 1 ? "s" : ""}
            </span>
            {preview.live && <span className="text-slate-500"> · lu en direct dans le CRM (propriété embarquée à la prochaine synchro)</span>}
          </p>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={() =>
                onAdd({
                  ...proposal,
                  id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bs_${Date.now()}`,
                  enabled: true,
                  periods,
                  coverage: { count: preview.count, total: preview.total },
                })
              }
              className={btnPrimary}
            >
              ✓ Valider — l&apos;ajouter au brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Focus sur un UTILISATEUR du CRM : le brief d'équipe ne porte que sur ses
 * fiches. On choisit l'OBJET sur lequel le propriétaire est indexé (deal,
 * contact, ticket) et on peut vérifier le câblage (combien de fiches de cet
 * objet ont réellement un propriétaire) avant de compter dessus.
 */
function OwnerFocus({
  team,
  cfg,
  owners,
  hasToken,
  crmLabel,
  writeCfg,
}: {
  team: BriefTeamId;
  cfg: BriefTeamConfig;
  owners: { id: string; name: string }[];
  hasToken: boolean;
  crmLabel: string | null;
  writeCfg: (mutate: (c: BriefTeamConfig) => BriefTeamConfig) => void;
}) {
  // Objets filtrables par propriétaire pour cette équipe (les entreprises ne
  // portent pas le filtre côté brief — le propriétaire vit sur deal/contact/ticket).
  // Choix libre : objet du propriétaire pris en charge pour l'objet principal
  // de l'équipe (direct + associations). Ticket réservé au pôle service client.
  const primary = defaultOwnerObject(team);
  const objs = (supportedOwnerObjects(primary) as BriefCrmObject[]).filter((o) => o !== "tickets" || team === "cs");
  const ownerObject = cfg.ownerObject ?? defaultOwnerObject(team);
  const [check, setCheck] = useState<{ loading: boolean; error: string | null; coverage: { withValue: number; total: number } | null }>({
    loading: false,
    error: null,
    coverage: null,
  });

  async function verify() {
    if (check.loading || !hasToken) return;
    setCheck({ loading: true, error: null, coverage: null });
    try {
      const res = await fetch("/api/voice/brief-team/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "property", object: ownerObject, name: OWNER_PROP[ownerObject], label: "Propriétaire" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.ok) throw new Error(d.error || "Vérification impossible.");
      setCheck({ loading: false, error: null, coverage: d.coverage ?? null });
    } catch (e) {
      setCheck({ loading: false, error: e instanceof Error ? e.message : "Erreur inconnue", coverage: null });
    }
  }

  return (
    <div className="mt-3 rounded-md border border-slate-200 bg-white/70 p-2.5">
      <p className="text-[11px] font-semibold text-slate-700">Focus sur un utilisateur (optionnel)</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Restreins tout le brief aux fiches d&apos;un utilisateur du CRM. Choisis l&apos;objet sur lequel le propriétaire
        est indexé, puis l&apos;utilisateur.
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-slate-500">Propriétaire du</span>
        <select
          value={ownerObject}
          onChange={(e) => { setCheck({ loading: false, error: null, coverage: null }); writeCfg((c) => ({ ...c, ownerObject: e.target.value as BriefCrmObject })); }}
          className={input}
        >
          {objs.map((o) => (
            <option key={o} value={o}>{CRM_OBJECT_LABELS[o].toLowerCase()}</option>
          ))}
        </select>
        <select
          value={cfg.ownerId ?? ""}
          onChange={(e) => {
            const id = e.target.value || null;
            const name = id ? owners.find((o) => o.id === id)?.name ?? null : null;
            setCheck({ loading: false, error: null, coverage: null });
            writeCfg((c) => ({ ...c, ownerId: id, ownerName: name, ownerObject: id ? (c.ownerObject ?? defaultOwnerObject(team)) : null }));
          }}
          className={`${input} min-w-0 flex-1`}
        >
          <option value="">Toute l&apos;équipe (pas de focus)</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {cfg.ownerId && (
          <button type="button" onClick={verify} disabled={check.loading || !hasToken} className={btnPrimary}>
            {check.loading ? "Vérification…" : "Vérifier le câblage"}
          </button>
        )}
      </div>
      {owners.length === 0 && <p className="mt-1 text-[10px] text-slate-400">Aucun utilisateur synchronisé depuis le CRM pour l&apos;instant.</p>}
      {check.error && <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-[10px] text-rose-600">{check.error}</p>}
      {check.coverage && (
        <p className="mt-1 rounded bg-indigo-50/50 px-2 py-1 text-[10px] text-slate-600">
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ CÂBLÉ{crmLabel ? ` · ${crmLabel}` : ""}</span>{" "}
          <span className={check.coverage.withValue > 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
            {check.coverage.withValue} sur {check.coverage.total} {CRM_OBJECT_LABELS[ownerObject].toLowerCase()} ont un propriétaire
          </span>{" "}
          — le filtre s&apos;applique sur ce champ.
        </p>
      )}
    </div>
  );
}

export function BriefTeamSettingsPanel({ settings }: { settings: BriefTeamSettings }) {
  const [open, setOpen] = useState(settings.enabled);
  const [options, setOptions] = useState<Options | null>(null);

  useEffect(() => {
    if (!open || options) return;
    let alive = true;
    fetch("/api/voice/brief-team/options")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.me) setOptions(d as Options); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, options]);

  const isAdmin = options?.me.isAdmin ?? false;
  const ownTeam = options?.me.pole ?? null;
  // Membre rattaché à un pôle : équipe présélectionnée et verrouillée.
  const team: BriefTeamId = !isAdmin && ownTeam ? ownTeam : settings.team;
  const cfg: BriefTeamConfig = settings.configs[team] ?? emptyTeamConfig();

  const write = useCallback((patch: Partial<BriefTeamSettings>) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, briefTeam: { ...cur.briefTeam, ...patch } });
  }, []);
  const writeCfg = useCallback((mutate: (c: BriefTeamConfig) => BriefTeamConfig) => {
    const cur = readTowerSettings();
    const prev = cur.briefTeam.configs[team] ?? emptyTeamConfig();
    writeTowerSettings({ ...cur, briefTeam: { ...cur.briefTeam, team, configs: { ...cur.briefTeam.configs, [team]: mutate(prev) } } });
  }, [team]);

  // Propriétés déjà déclinées en suggestions (validées) → on ne repropose que le reste.
  const proposals = useMemo(() => {
    const taken = new Set(cfg.customSuggestions.map((s) => `${s.object}:${s.property}:${s.kind}`));
    return cfg.customProperties.flatMap((p) => suggestionsForProperty(p)).filter((s) => !taken.has(`${s.object}:${s.property}:${s.kind}`));
  }, [cfg.customProperties, cfg.customSuggestions]);

  const blockDefs = TEAM_BLOCKS[team];
  const active = activeBlockCount(cfg);

  if (!open) {
    return (
      <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-800">✨ Brief personnalisé par équipe</p>
            <p className="mt-0.5 text-[11px] text-slate-600">
              Choisis ton équipe, ses pipelines et ses suggestions (deals en cours, signés par propriétaire, stagnants, prêts à signer…),
              déclare tes propriétés CRM de suivi et valide des suggestions personnalisées calculées sur tes vraies données.
            </p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-fuchsia-500">
            Configurer mon brief personnalisé
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-800">✨ Brief personnalisé par équipe</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {active > 0 ? `${active} contenu${active > 1 ? "s" : ""} actif${active > 1 ? "s" : ""} pour ${briefTeamLabel(team)}.` : "Coche les suggestions à lire dans ton brief."}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-700">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => write({ enabled: e.target.checked, team })} className="h-3.5 w-3.5 accent-[var(--accent)]" />
          Lire ce brief d&apos;équipe dans mon brief du jour
        </label>
      </div>

      {/* 1. Équipe */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-700">1 · Équipe</span>
        <select
          value={team}
          onChange={(e) => write({ team: e.target.value as BriefTeamId })}
          disabled={!isAdmin}
          className={`${input} disabled:opacity-60`}
        >
          {BRIEF_TEAMS.filter((t) => isAdmin || !ownTeam || t.id === ownTeam).map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <span className="text-[10px] text-slate-400">
          {options == null ? "Chargement…" : isAdmin ? "Admin : tu choisis l'équipe, chaque équipe garde sa configuration." : ownTeam ? "Présélectionnée d'après ton pôle." : "Sans pôle attribué : choisis l'équipe à suivre."}
        </span>
      </div>

      {/* 1b. Focus sur un utilisateur du CRM (propriétaire) */}
      <OwnerFocus
        team={team}
        cfg={cfg}
        owners={options?.owners ?? []}
        hasToken={options?.hasToken ?? false}
        crmLabel={options?.crmLabel ?? null}
        writeCfg={writeCfg}
      />

      {/* 2. Pipelines (Ventes) */}
      {team === "sales" && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-700">2 · Pipelines pris dans le brief</p>
          {options && options.pipelines.length === 0 ? (
            <p className="mt-1 text-[10px] text-slate-400">Aucun pipeline synchronisé — tous les deals sont pris.</p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(options?.pipelines ?? []).map((p) => {
                const on = cfg.pipelines.includes(p.id);
                return (
                  <label key={p.id} className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition ${on ? "border-accent/50 bg-accent/10 text-slate-800" : "border-slate-200 bg-white text-slate-500 hover:border-accent/30"}`}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => writeCfg((c) => ({ ...c, pipelines: e.target.checked ? [...c.pipelines, p.id] : c.pipelines.filter((x) => x !== p.id) }))}
                      className="h-3 w-3 accent-[var(--accent)]"
                    />
                    {p.label}
                  </label>
                );
              })}
              <span className="self-center text-[10px] text-slate-400">{cfg.pipelines.length === 0 ? "Aucun coché = tous les pipelines." : `${cfg.pipelines.length} sélectionné${cfg.pipelines.length > 1 ? "s" : ""}.`}</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Suggestions de l'équipe */}
      <div className="mt-3">
        <p className="text-[11px] font-semibold text-slate-700">{team === "sales" ? "3" : "2"} · Suggestions {briefTeamLabel(team)}</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {blockDefs.map((def: BriefBlockDef) => {
            const b = cfg.blocks[def.id];
            const on = !!b?.enabled;
            const allowed = periodsFor(def);
            return (
              <div key={def.id} className={`rounded-md border p-2 transition ${on ? "border-accent/40 bg-white" : "border-slate-200 bg-white/70"}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => writeCfg((c) => ({ ...c, blocks: { ...c.blocks, [def.id]: e.target.checked ? { ...(c.blocks[def.id] ?? defaultBlockConfig(def)), enabled: true } : { ...(c.blocks[def.id] ?? defaultBlockConfig(def)), enabled: false } } }))}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-xs font-medium text-slate-800">{def.label}</span>
                    <span className="block text-[10px] text-slate-500">{def.hint}</span>
                  </span>
                </label>
                {on && b && (
                  <div className="pl-5">
                    <PeriodPicker allowed={allowed} value={b.periods} onChange={(v) => writeCfg((c) => ({ ...c, blocks: { ...c.blocks, [def.id]: { ...b, periods: v } } }))} />
                    {allowed.length > 0 && b.periods.length === 0 && <p className="mt-1 text-[10px] text-amber-700">Coche au moins une période pour que ce bloc soit lu.</p>}
                    {def.days && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-medium text-slate-500">{def.days.label} :</span>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={b.days ?? def.days.default}
                          onChange={(e) => writeCfg((c) => ({ ...c, blocks: { ...c.blocks, [def.id]: { ...b, days: Math.min(365, Math.max(1, Number(e.target.value) || def.days!.default)) } } }))}
                          className={`${input} w-16`}
                        />
                        <span className="text-[10px] text-slate-400">jours</span>
                      </div>
                    )}
                    {def.forecast && (
                      <DatePropertyPicker
                        value={b.dateProperty}
                        customProps={cfg.customProperties}
                        onChange={(v) => writeCfg((c) => ({ ...c, blocks: { ...c.blocks, [def.id]: { ...b, dateProperty: v } } }))}
                      />
                    )}
                    {def.ownerBreakdown && (
                      <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[10px] text-slate-600">
                        <input
                          type="checkbox"
                          checked={!!b.byOwner}
                          onChange={(e) => writeCfg((c) => ({ ...c, blocks: { ...c.blocks, [def.id]: { ...b, byOwner: e.target.checked } } }))}
                          className="h-3 w-3 accent-[var(--accent)]"
                        />
                        Ventiler par propriétaire (de la transaction)
                      </label>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Propriétés CRM personnalisées */}
      <div className="mt-3">
        <p className="text-[11px] font-semibold text-slate-700">{team === "sales" ? "4" : "3"} · Propriétés du CRM (date de fermeture, suivi important)</p>
        <p className="text-[10px] text-slate-500">
          Si une propriété personnalisée fait office de date de fermeture ou de suivi dans tes pipelines, déclare-la ici : elle est vérifiée dans le CRM, puis proposée dans les prévisions et en suggestions personnalisées.
        </p>
        {cfg.customProperties.length > 0 && (
          <div className="mt-1.5 space-y-1">
            {cfg.customProperties.map((p) => (
              <div key={`${p.object}:${p.name}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5">
                <p className="text-[11px] text-slate-700">
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">✓ CRM</span>{" "}
                  <span className="font-medium">{p.label}</span> <span className="text-slate-400">({p.name})</span> · {CRM_OBJECT_LABELS[p.object]} ·{" "}
                  {BRIEF_PROPERTY_ROLE_LABELS[p.role]}
                  {p.coverage && <span className="text-slate-500"> · {p.coverage.withValue}/{p.coverage.total} renseignés</span>}
                </p>
                <button
                  type="button"
                  onClick={() => writeCfg((c) => ({
                    ...c,
                    customProperties: c.customProperties.filter((x) => !(x.object === p.object && x.name === p.name)),
                    customSuggestions: c.customSuggestions.filter((s) => !(s.object === p.object && s.property === p.name)),
                    blocks: Object.fromEntries(Object.entries(c.blocks).map(([k, v]) => [k, v.dateProperty === p.name ? { ...v, dateProperty: null } : v])),
                  }))}
                  className="text-[10px] text-slate-400 hover:text-rose-600"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
        <AddCustomProperty
          team={team}
          hasToken={options?.hasToken ?? false}
          crmLabel={options?.crmLabel ?? null}
          onAdd={(p) => writeCfg((c) => ({ ...c, customProperties: [...c.customProperties.filter((x) => !(x.object === p.object && x.name === p.name)), p].slice(0, 12) }))}
        />
      </div>

      {/* 5. Suggestions personnalisées */}
      {(cfg.customProperties.length > 0 || cfg.customSuggestions.length > 0) && (
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-slate-700">{team === "sales" ? "5" : "4"} · Suggestions personnalisées (rapprochement vérifié)</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {cfg.customSuggestions.map((s) => (
              <div key={s.id} className={`group relative rounded-md border p-2 ${s.enabled ? "border-accent/40 bg-white" : "border-slate-200 bg-white/70"}`}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => writeCfg((c) => ({ ...c, customSuggestions: c.customSuggestions.map((x) => (x.id === s.id ? { ...x, enabled: e.target.checked } : x)) }))}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 pr-4">
                    <span className="block text-xs font-medium text-slate-800">{s.label}</span>
                    <span className="block text-[10px] text-slate-500">
                      Suggestion personnalisée · « {s.propertyLabel} »{s.coverage ? ` · ${s.coverage.count} fiche${s.coverage.count > 1 ? "s" : ""} au rapprochement` : ""} — recalculée à chaque brief
                    </span>
                  </span>
                </label>
                {s.enabled && s.kind === "date_window" && (
                  <div className="pl-5">
                    <PeriodPicker
                      allowed={BRIEF_PERIODS.map((p) => p.id)}
                      value={s.periods}
                      onChange={(v) => writeCfg((c) => ({ ...c, customSuggestions: c.customSuggestions.map((x) => (x.id === s.id ? { ...x, periods: v } : x)) }))}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => writeCfg((c) => ({ ...c, customSuggestions: c.customSuggestions.filter((x) => x.id !== s.id) }))}
                  title="Retirer cette suggestion du brief"
                  className="absolute right-1.5 top-1.5 hidden rounded-full px-1 text-[10px] text-slate-400 transition hover:text-rose-600 group-hover:block"
                >
                  ✕
                </button>
              </div>
            ))}
            {proposals.map((p) => (
              <ProposedSuggestion
                key={`${p.object}:${p.property}:${p.kind}`}
                team={team}
                cfg={cfg}
                proposal={p}
                onAdd={(s) => writeCfg((c) => ({ ...c, customSuggestions: [...c.customSuggestions, s].slice(0, 16) }))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pas d'aperçu ici : le brief d'équipe s'écoute depuis l'orbe de la
          home (CTA « Chiffres <équipe> ») — un aperçu dans les réglages ferait
          doublon. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-fuchsia-100 pt-3">
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>Replier</button>
        {active === 0 && <span className="text-[10px] text-slate-400">Coche au moins une suggestion.</span>}
      </div>
    </div>
  );
}
