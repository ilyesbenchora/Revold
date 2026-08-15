"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CUSTOM_ENTITIES, ENTITY_FIELDS, type CustomEntity } from "@/lib/integrations/custom-connector";

/**
 * Assistant « Connecter un outil sur mesure » (ERP maison, logiciel métier).
 *
 * Revold ne devine pas les endpoints d'un outil qu'il ne connaît pas : ils se
 * déclarent UNE fois, avec un test en direct. À chaque test, Revold affiche la
 * réponse réelle, détecte où se trouve la liste d'enregistrements, liste les
 * champs disponibles et PRÉ-REMPLIT la correspondance vers son modèle
 * canonique. La clé de jointure est l'ID de rapprochement partagé avec le CRM.
 */

type EndpointDraft = {
  entity: CustomEntity;
  path: string;
  recordsPath: string;
  paginationType: "none" | "page" | "offset" | "cursor";
  paginationParam: string;
  sizeParam: string;
  size: number;
  cursorPath: string;
  fieldMap: Record<string, string>;
  keys: string[];
  sample: Record<string, unknown> | null;
  tested: boolean;
  count: number;
  error: string | null;
};

const emptyEndpoint = (entity: CustomEntity): EndpointDraft => ({
  entity,
  path: "",
  recordsPath: "",
  paginationType: "none",
  paginationParam: "page",
  sizeParam: "per_page",
  size: 100,
  cursorPath: "",
  fieldMap: {},
  keys: [],
  sample: null,
  tested: false,
  count: 0,
  error: null,
});

const field = "rounded-lg border border-card-border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-accent";

export function CustomConnectorWizard({ existing }: { existing?: { id: string; label: string; base_url: string; auth_type: string; auth_param: string | null } | null }) {
  const router = useRouter();
  const [label, setLabel] = useState(existing?.label ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
  const [authType, setAuthType] = useState<string>(existing?.auth_type ?? "bearer");
  const [authParam, setAuthParam] = useState(existing?.auth_param ?? "X-API-Key");
  const [authValue, setAuthValue] = useState("");
  const [endpoints, setEndpoints] = useState<EndpointDraft[]>([emptyEndpoint("companies")]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState<number | null>(null);

  const patch = (i: number, p: Partial<EndpointDraft>) =>
    setEndpoints((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...p } : e)));

  async function testEndpoint(i: number) {
    const ep = endpoints[i];
    if (!ep.path.trim() || testing != null) return;
    setTesting(i);
    setError(null);
    try {
      const res = await fetch("/api/custom-connectors/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorId: existing?.id,
          baseUrl,
          authType,
          authParam,
          authValue: authValue || undefined,
          path: ep.path,
          recordsPath: ep.recordsPath || undefined,
          entity: ep.entity,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || d.ok === false) {
        patch(i, { tested: false, error: d.error || "Test échoué", keys: [], sample: null });
        return;
      }
      patch(i, {
        tested: true,
        error: null,
        count: d.count ?? 0,
        keys: (d.keys ?? []) as string[],
        sample: (d.sample ?? null) as Record<string, unknown> | null,
        recordsPath: ep.recordsPath || (d.detectedPath ?? ""),
        // Correspondance pré-remplie par détection de nommage — modifiable.
        fieldMap: { ...(d.suggestion ?? {}), ...ep.fieldMap },
      });
    } catch (e) {
      patch(i, { tested: false, error: e instanceof Error ? e.message : "Test échoué" });
    } finally {
      setTesting(null);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch("/api/custom-connectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: existing?.id,
          label,
          baseUrl,
          authType,
          authParam,
          authValue: authValue || undefined,
          endpoints: endpoints
            .filter((e) => e.path.trim())
            .map((e) => ({
              entity: e.entity,
              path: e.path,
              recordsPath: e.recordsPath,
              pagination:
                e.paginationType === "none"
                  ? { type: "none" }
                  : {
                      type: e.paginationType,
                      param: e.paginationParam,
                      sizeParam: e.sizeParam || undefined,
                      size: e.size,
                      cursorPath: e.paginationType === "cursor" ? e.cursorPath : undefined,
                    },
              fieldMap: e.fieldMap,
            })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Enregistrement impossible");
      setSaved(d.id as string);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  async function syncNow(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/custom-connectors/${id}/sync`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Synchronisation impossible");
      const c = d.counts ?? {};
      setError(null);
      setSaved(id);
      alert(
        `Synchronisation terminée :\n` +
          `${c.companies ?? 0} clients · ${c.invoices ?? 0} factures · ${c.subscriptions ?? 0} abonnements · ` +
          `${c.transactions ?? 0} transactions · ${c.tickets ?? 0} tickets\n` +
          `${c.unmatched ?? 0} enregistrements sans ID de rapprochement exploitable.` +
          (d.errors?.length ? `\n\nAvertissements : ${d.errors.join(" · ")}` : ""),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  const availableEntities = CUSTOM_ENTITIES.filter((e) => !endpoints.some((x) => x.entity === e));

  return (
    <div className="space-y-4">
      {/* ── 1. Connexion ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">1. Connexion à l&apos;outil</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          L&apos;URL de base de son API et la façon de s&apos;authentifier. Ces informations sont stockées chiffrées et
          ne sont jamais renvoyées au navigateur.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">Nom de l&apos;outil</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="GAIA" className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">URL de base de l&apos;API</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.gaia.exemple.fr" className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Authentification</label>
            <select value={authType} onChange={(e) => setAuthType(e.target.value)} className={`${field} mt-1 w-full`}>
              <option value="bearer">Jeton Bearer (Authorization)</option>
              <option value="header">Clé dans un en-tête</option>
              <option value="query">Clé dans l&apos;URL</option>
              <option value="none">Aucune</option>
            </select>
          </div>
          {(authType === "header" || authType === "query") && (
            <div>
              <label className="text-xs font-medium text-slate-500">
                {authType === "header" ? "Nom de l'en-tête" : "Nom du paramètre"}
              </label>
              <input value={authParam} onChange={(e) => setAuthParam(e.target.value)} placeholder="X-API-Key" className={`${field} mt-1 w-full`} />
            </div>
          )}
          {authType !== "none" && (
            <div className="md:col-span-2">
              <label className="text-xs font-medium text-slate-500">Clé / jeton</label>
              <input
                type="password"
                value={authValue}
                onChange={(e) => setAuthValue(e.target.value)}
                placeholder={existing ? "•••••••• (inchangé si vide)" : "Colle la clé fournie par l'outil"}
                className={`${field} mt-1 w-full font-mono`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Endpoints & correspondance ── */}
      {endpoints.map((ep, i) => {
        const def = ENTITY_FIELDS[ep.entity];
        return (
          <div key={ep.entity} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">2. {def.label}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{def.hint}</p>
              </div>
              {endpoints.length > 1 && (
                <button
                  onClick={() => setEndpoints((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-[11px] text-slate-400 hover:text-rose-500"
                >
                  Retirer
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium text-slate-500">Chemin de l&apos;endpoint</label>
                <input
                  value={ep.path}
                  onChange={(e) => patch(i, { path: e.target.value, tested: false })}
                  placeholder="/api/v1/clients"
                  className={`${field} mt-1 w-full font-mono`}
                />
              </div>
              <button
                onClick={() => testEndpoint(i)}
                disabled={!ep.path.trim() || testing != null}
                className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {testing === i ? "Test…" : "Tester l'endpoint"}
              </button>
            </div>

            {ep.error && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{ep.error}</p>}

            {ep.tested && (
              <>
                <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  ✓ {ep.count} enregistrement{ep.count > 1 ? "s" : ""} reçu{ep.count > 1 ? "s" : ""}
                  {ep.recordsPath && <> · liste détectée dans <code className="rounded bg-white/60 px-1">{ep.recordsPath}</code></>}
                  {" "}· {ep.keys.length} champs disponibles
                </p>

                {/* Correspondance champ canonique → champ de l'outil */}
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Correspondance des champs</p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {def.fields.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <label className="w-44 shrink-0 text-[11px] text-slate-600" title={f.hint}>
                          {f.label}
                          {f.required && <span className="text-rose-500"> *</span>}
                        </label>
                        <select
                          value={ep.fieldMap[f.id] ?? ""}
                          onChange={(e) => patch(i, { fieldMap: { ...ep.fieldMap, [f.id]: e.target.value } })}
                          className={`${field} min-w-0 flex-1 py-1.5 text-xs`}
                        >
                          <option value="">— non fourni —</option>
                          {ep.keys.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pagination */}
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-500">Pagination</label>
                    <select
                      value={ep.paginationType}
                      onChange={(e) => patch(i, { paginationType: e.target.value as EndpointDraft["paginationType"] })}
                      className={`${field} mt-1 py-1.5 text-xs`}
                    >
                      <option value="none">Aucune (tout en une fois)</option>
                      <option value="page">Par numéro de page</option>
                      <option value="offset">Par décalage (offset)</option>
                      <option value="cursor">Par curseur</option>
                    </select>
                  </div>
                  {ep.paginationType !== "none" && (
                    <>
                      <div>
                        <label className="text-[11px] font-medium text-slate-500">Paramètre</label>
                        <input value={ep.paginationParam} onChange={(e) => patch(i, { paginationParam: e.target.value })} className={`${field} mt-1 w-28 py-1.5 text-xs font-mono`} />
                      </div>
                      {ep.paginationType !== "cursor" && (
                        <>
                          <div>
                            <label className="text-[11px] font-medium text-slate-500">Taille (param)</label>
                            <input value={ep.sizeParam} onChange={(e) => patch(i, { sizeParam: e.target.value })} className={`${field} mt-1 w-28 py-1.5 text-xs font-mono`} />
                          </div>
                          <div>
                            <label className="text-[11px] font-medium text-slate-500">Taille</label>
                            <input type="number" value={ep.size} onChange={(e) => patch(i, { size: Number(e.target.value) || 100 })} className={`${field} mt-1 w-20 py-1.5 text-xs`} />
                          </div>
                        </>
                      )}
                      {ep.paginationType === "cursor" && (
                        <div>
                          <label className="text-[11px] font-medium text-slate-500">Chemin du curseur suivant</label>
                          <input value={ep.cursorPath} onChange={(e) => patch(i, { cursorPath: e.target.value })} placeholder="meta.next_cursor" className={`${field} mt-1 w-48 py-1.5 text-xs font-mono`} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {ep.sample && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                      Voir un enregistrement reçu
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                      {JSON.stringify(ep.sample, null, 2)}
                    </pre>
                  </details>
                )}
              </>
            )}
          </div>
        );
      })}

      {availableEntities.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Ajouter une donnée à synchroniser :</span>
          {availableEntities.map((e) => (
            <button
              key={e}
              onClick={() => setEndpoints((prev) => [...prev, emptyEndpoint(e)])}
              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-accent hover:text-accent"
            >
              ＋ {ENTITY_FIELDS[e].label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {saved && (
          <button
            onClick={() => syncNow(saved)}
            disabled={saving}
            className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/5 disabled:opacity-50"
          >
            {saving ? "Synchronisation…" : "▶ Synchroniser maintenant"}
          </button>
        )}
        <button
          onClick={save}
          disabled={saving || !label.trim() || !baseUrl.trim()}
          className="rounded-lg bg-gradient-to-r from-fuchsia-600 to-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-fuchsia-500 hover:to-pink-500 disabled:opacity-50"
        >
          {saving ? "Enregistrement…" : saved ? "✓ Enregistré — mettre à jour" : "Enregistrer le connecteur"}
        </button>
      </div>
    </div>
  );
}
