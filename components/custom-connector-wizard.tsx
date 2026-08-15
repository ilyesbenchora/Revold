"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CUSTOM_ENTITIES,
  CUSTOM_CATEGORIES,
  ENTITY_FIELDS,
  PAGE_REQUIREMENTS,
  entitiesForPages,
  type CustomEntity,
} from "@/lib/integrations/custom-connector";
import { InfoHint } from "@/components/info-hint";

/** Message prêt à envoyer à l'éditeur / au développeur de l'outil. */
const VENDOR_REQUEST = `Bonjour,

Nous connectons notre logiciel à Revold (plateforme d'analyse de nos données commerciales et financières). Revold a besoin d'un accès en LECTURE SEULE à votre API. Pourriez-vous nous transmettre :

1. L'adresse de base de l'API (exemple : https://api.votre-outil.fr)
2. Une clé d'accès en lecture seule, et la façon de l'utiliser (jeton "Bearer", en-tête type X-API-Key, ou paramètre dans l'URL)
3. Les adresses (endpoints) permettant de lister : les clients, les contacts, les factures, et le cas échéant les abonnements, les paiements et les tickets
4. Confirmation que chaque enregistrement contient bien le CODE CLIENT que nous utilisons aussi dans notre CRM (c'est la clé qui permet de rapprocher les deux outils)
5. Le fonctionnement de la pagination si les listes sont longues (numéro de page, décalage, curseur)

Merci d'avance.`;

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

export function CustomConnectorWizard({
  existing,
}: {
  existing?: {
    id: string;
    label: string;
    base_url: string;
    auth_type: string;
    auth_param: string | null;
    description?: string | null;
    category?: string | null;
  } | null;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(existing?.label ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [category, setCategory] = useState(existing?.category ?? "billing");
  const [baseUrl, setBaseUrl] = useState(existing?.base_url ?? "");
  const [authType, setAuthType] = useState<string>(existing?.auth_type ?? "bearer");
  const [authParam, setAuthParam] = useState(existing?.auth_param ?? "X-API-Key");
  const [authValue, setAuthValue] = useState("");
  const [pages, setPages] = useState<string[]>([]);
  const [endpoints, setEndpoints] = useState<EndpointDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
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
          description,
          category,
          attachTargets: true,
          pages,
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
          `${c.companies ?? 0} entreprises · ${c.contacts ?? 0} contacts · ${c.deals ?? 0} affaires\n` +
          `${c.invoices ?? 0} factures · ${c.subscriptions ?? 0} abonnements · ${c.transactions ?? 0} transactions · ${c.tickets ?? 0} tickets\n` +
          `${c.unmatched ?? 0} enregistrements sans clé de rapprochement exploitable.` +
          (d.errors?.length ? `\n\nAvertissements : ${d.errors.join(" · ")}` : ""),
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  }

  /** Coche/décoche une page : les objets REQUIS apparaissent automatiquement. */
  function togglePage(key: string) {
    const next = pages.includes(key) ? pages.filter((p) => p !== key) : [...pages, key];
    setPages(next);
    const { required } = entitiesForPages(next);
    setEndpoints((prev) => {
      const kept = prev.filter((e) => required.includes(e.entity) || e.path.trim());
      const missing = required.filter((r) => !kept.some((e) => e.entity === r));
      return [...kept, ...missing.map(emptyEndpoint)];
    });
  }

  const { required: requiredEntities, optional: optionalEntities } = entitiesForPages(pages);
  const configuredEntities = endpoints.filter((e) => e.path.trim()).map((e) => e.entity);
  // Objets proposés en complément : d'abord ceux utiles aux pages choisies.
  const suggestedEntities = optionalEntities.filter((e) => !endpoints.some((x) => x.entity === e));
  const otherEntities = CUSTOM_ENTITIES.filter(
    (e) => !endpoints.some((x) => x.entity === e) && !suggestedEntities.includes(e),
  );
  // Pages cochées dont il manque un objet obligatoire → alerte explicite.
  const incompletePages = PAGE_REQUIREMENTS.filter(
    (p) => pages.includes(p.key) && p.required.some((r) => !configuredEntities.includes(r)),
  );

  return (
    <div className="space-y-4">
      {/* ── Aide : où trouver ces informations ── */}
      <div className="card border-indigo-200/70 bg-indigo-50/40 p-4">
        <p className="text-sm font-semibold text-slate-900">🙋 Tu ne sais pas où trouver ces informations ?</p>
        <p className="mt-1 text-xs text-slate-600">
          C&apos;est normal : elles viennent de l&apos;éditeur ou du développeur de l&apos;outil (documentation
          « API » / « développeurs », ou demande directe). Copie le message ci-dessous et envoie-le lui — il contient
          exactement ce dont Revold a besoin, rien de plus.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-accent hover:underline">
            Voir le message à envoyer
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-[11px] leading-relaxed text-slate-600">
            {VENDOR_REQUEST}
          </pre>
        </details>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(VENDOR_REQUEST);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          }}
          className="mt-2 rounded-lg border border-accent bg-white px-3 py-1.5 text-xs font-semibold text-accent transition hover:bg-accent/5"
        >
          {copied ? "✓ Message copié" : "📋 Copier le message pour l'éditeur"}
        </button>
      </div>

      {/* ── 1. Connexion ── */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-slate-900">1. Connexion à l&apos;outil</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          L&apos;adresse de son API et la façon de s&apos;y authentifier. Ces informations sont stockées de façon
          sécurisée et ne réapparaissent jamais dans le navigateur.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-slate-500">Nom de l&apos;outil</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="GAIA" className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              Famille d&apos;outil
              <InfoHint
                wide
                text={"Détermine les pages et les agents auxquels l'outil est rattaché par défaut (tu pourras ajuster ensuite dans Paramètres → Intégrations → Outil source par page)."}
              />
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} mt-1 w-full`}>
              {CUSTOM_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              À quoi sert cet outil ? <span className="text-rose-500">*</span>
              <InfoHint
                wide
                text={"En une ou deux phrases, dans tes mots. Ce texte est transmis aux agents IA : sans lui, « GAIA » n'est qu'un nom vide et l'agent analyse à l'aveugle.\n\nExemple : « GAIA est notre logiciel de gestion des interventions terrain. Chaque intervention réalisée chez un client génère une facture mensuelle regroupée. »"}
              />
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ex : GAIA est notre logiciel de gestion des interventions terrain — chaque intervention chez un client génère une facture."
              className={`${field} mt-1 w-full resize-none`}
            />
            <p className="mt-0.5 text-[11px] text-slate-400">
              Utilisé par les agents pour interpréter correctement tes données (vocabulaire métier, nature des
              enregistrements).
            </p>
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              Adresse de l&apos;API
              <InfoHint
                wide
                text={"L'adresse Internet par laquelle on interroge le logiciel — différente de l'adresse où tes équipes se connectent.\n\nExemple : si tes équipes utilisent gaia.monentreprise.fr, l'API est souvent api.gaia.monentreprise.fr ou gaia.monentreprise.fr/api.\n\nOù la trouver : documentation « API » ou « développeurs » de l'outil, ou demande à son éditeur (message à copier en haut de page)."}
              />
            </label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.gaia.exemple.fr" className={`${field} mt-1 w-full`} />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
              Authentification
              <InfoHint
                wide
                text={"Comment l'outil vérifie que c'est bien toi qui demandes les données. L'éditeur te dira laquelle utiliser :\n\n• Jeton Bearer : le plus courant\n• Clé dans un en-tête : une clé envoyée sous un nom précis (ex. X-API-Key)\n• Clé dans l'URL : la clé s'ajoute à l'adresse (ex. ?api_key=…)\n• Aucune : rare, uniquement pour les API ouvertes.\n\nDans le doute, essaie « Jeton Bearer » : le test t'indiquera si c'est refusé."}
              />
            </label>
            <select value={authType} onChange={(e) => setAuthType(e.target.value)} className={`${field} mt-1 w-full`}>
              <option value="bearer">Jeton Bearer (le plus courant)</option>
              <option value="header">Clé dans un en-tête</option>
              <option value="query">Clé dans l&apos;URL</option>
              <option value="none">Aucune</option>
            </select>
          </div>
          {(authType === "header" || authType === "query") && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                {authType === "header" ? "Nom de l'en-tête" : "Nom du paramètre"}
                <InfoHint
                  wide
                  text={
                    authType === "header"
                      ? "L'étiquette sous laquelle envoyer la clé. L'éditeur te donne un nom précis, souvent X-API-Key, Api-Key ou Token. Recopie-le à l'identique (majuscules comprises)."
                      : "Le nom du paramètre à ajouter à l'adresse, souvent api_key, key ou token. Exemple : ?api_key=abc123 → écris ici api_key."
                  }
                />
              </label>
              <input value={authParam} onChange={(e) => setAuthParam(e.target.value)} placeholder="X-API-Key" className={`${field} mt-1 w-full`} />
            </div>
          )}
          {authType !== "none" && (
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                Clé / jeton
                <InfoHint
                  wide
                  text={"La suite de caractères secrète fournie par l'éditeur (ex. sk_live_4f8a…). Demande une clé en LECTURE SEULE : Revold n'a jamais besoin de modifier les données de l'outil.\n\nElle est stockée de façon sécurisée et n'est plus jamais réaffichée. Pour la changer, il suffit d'en saisir une nouvelle."}
                />
              </label>
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

      {/* ── 2. QUE doit alimenter cet outil ? (pilote tout le reste) ── */}
      <div className="card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          2. Que doit alimenter cet outil dans Revold ?
          <InfoHint
            wide
            text={"Coche les pages que cet outil doit nourrir — le même choix que « Outil source par page » dans les Paramètres.\n\nRevold en déduit les données à aller chercher : tu n'auras à fournir que les adresses réellement nécessaires."}
          />
        </h3>
        <p className="mt-0.5 text-xs text-slate-500">
          C&apos;est ce choix qui détermine les données à récupérer — et il rattache l&apos;outil aux bonnes pages et
          aux bons agents à l&apos;enregistrement.
        </p>
        <div className="mt-3 space-y-3">
          {[...new Set(PAGE_REQUIREMENTS.map((p) => p.group))].map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {PAGE_REQUIREMENTS.filter((p) => p.group === group).map((p) => {
                  const on = pages.includes(p.key);
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePage(p.key)}
                      title={`Données nécessaires : ${p.required.map((r) => ENTITY_FIELDS[r].label).join(", ") || "aucune obligatoire"}`}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                        on
                          ? "border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50/40"
                      }`}
                    >
                      {on ? "✓ " : ""}{p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {pages.length > 0 && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Données à récupérer :{" "}
            <span className="font-semibold text-slate-800">
              {requiredEntities.map((e) => ENTITY_FIELDS[e].label).join(", ") || "aucune obligatoire"}
            </span>
            {optionalEntities.length > 0 && (
              <> · en complément (facultatif) : {optionalEntities.map((e) => ENTITY_FIELDS[e].label).join(", ")}</>
            )}
          </p>
        )}
      </div>

      {pages.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50/60 px-4 py-6 text-center text-xs text-slate-500">
          Choisis d&apos;abord ce que l&apos;outil doit alimenter ci-dessus : Revold affichera ensuite les seules
          données dont il a besoin.
        </p>
      )}

      {/* ── 3. Adresses & correspondance des données demandées ── */}
      {endpoints.map((ep, i) => {
        const def = ENTITY_FIELDS[ep.entity];
        return (
          <div key={ep.entity} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  {def.label}
                  {requiredEntities.includes(ep.entity) ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-600">REQUIS</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">FACULTATIF</span>
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">{def.hint}</p>
              </div>
              {!requiredEntities.includes(ep.entity) && (
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
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  Adresse de la liste ({def.label.toLowerCase()})
                  <InfoHint
                    wide
                    text={"La fin de l'adresse qui renvoie la LISTE de ces enregistrements — l'éditeur te la donne (ex. /api/v1/clients, /clients, /v2/invoices).\n\nAstuce : tu peux aussi coller l'adresse complète (https://…) si tu l'as en entier.\n\nClique ensuite sur « Tester » : Revold appelle vraiment l'outil et t'affiche ce qu'il reçoit."}
                  />
                </label>
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
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    Correspondance des champs
                    <InfoHint
                      wide
                      text={"À gauche : ce dont Revold a besoin. À droite : les champs réellement présents dans ton outil (détectés lors du test).\n\nRevold a déjà pré-rempli ce qu'il a reconnu — vérifie et corrige. Laisse « non fourni » si l'information n'existe pas dans l'outil : rien ne sera inventé."}
                    />
                  </p>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {def.fields.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <label className="flex w-44 shrink-0 items-center gap-1 text-[11px] text-slate-600">
                          {f.label}
                          {f.required && <span className="text-rose-500">*</span>}
                          {f.hint && <InfoHint text={f.hint} />}
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
                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                      Découpage des longues listes
                      <InfoHint
                        wide
                        text={"Quand il y a beaucoup d'enregistrements, la plupart des outils ne les renvoient pas d'un coup mais par paquets. Cette option dit à Revold comment demander la suite.\n\nSi le test ci-dessus t'a renvoyé un nombre rond (50, 100, 200…), c'est probablement le cas : demande à l'éditeur laquelle des trois méthodes utiliser. Sinon, laisse « Aucune »."}
                      />
                    </label>
                    <select
                      value={ep.paginationType}
                      onChange={(e) => patch(i, { paginationType: e.target.value as EndpointDraft["paginationType"] })}
                      className={`${field} mt-1 py-1.5 text-xs`}
                    >
                      <option value="none">Aucune — tout arrive d&apos;un coup</option>
                      <option value="page">Par numéro de page (page 1, 2, 3…)</option>
                      <option value="offset">Par décalage (0, 100, 200…)</option>
                      <option value="cursor">Par curseur (jeton « page suivante »)</option>
                    </select>
                  </div>
                  {ep.paginationType !== "none" && (
                    <>
                      <div>
                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                          Nom du paramètre
                          <InfoHint text="Le mot utilisé par l'outil dans l'adresse pour demander la suite — souvent « page », « offset » ou « cursor ». L'éditeur te le précise." />
                        </label>
                        <input value={ep.paginationParam} onChange={(e) => patch(i, { paginationParam: e.target.value })} className={`${field} mt-1 w-28 py-1.5 text-xs font-mono`} />
                      </div>
                      {ep.paginationType !== "cursor" && (
                        <>
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              Paramètre de taille
                              <InfoHint text="Le mot qui fixe le nombre d'enregistrements par paquet — souvent « per_page », « limit » ou « size ». Laisse vide si l'outil n'en propose pas." />
                            </label>
                            <input value={ep.sizeParam} onChange={(e) => patch(i, { sizeParam: e.target.value })} className={`${field} mt-1 w-28 py-1.5 text-xs font-mono`} />
                          </div>
                          <div>
                            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                              Par paquet
                              <InfoHint text="Combien d'enregistrements demander à chaque appel. 100 convient presque toujours ; baisse à 50 si l'outil est lent." />
                            </label>
                            <input type="number" value={ep.size} onChange={(e) => patch(i, { size: Number(e.target.value) || 100 })} className={`${field} mt-1 w-20 py-1.5 text-xs`} />
                          </div>
                        </>
                      )}
                      {ep.paginationType === "cursor" && (
                        <div>
                          <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                            Emplacement du curseur suivant
                            <InfoHint wide text={"Où trouver, dans la réponse de l'outil, le jeton qui donne accès au paquet suivant.\n\nExemple : si la réponse contient meta → next_cursor, écris meta.next_cursor. L'éditeur te l'indique."} />
                          </label>
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

      {pages.length > 0 && (suggestedEntities.length > 0 || otherEntities.length > 0) && (
        <div className="space-y-2">
          {suggestedEntities.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500">
                Enrichir les pages choisies (facultatif) :
              </span>
              {suggestedEntities.map((e) => (
                <button
                  key={e}
                  onClick={() => setEndpoints((prev) => [...prev, emptyEndpoint(e)])}
                  className="rounded-full border border-fuchsia-200 bg-fuchsia-50/60 px-2.5 py-1 text-[11px] font-medium text-fuchsia-700 hover:bg-fuchsia-100"
                >
                  ＋ {ENTITY_FIELDS[e].label}
                </button>
              ))}
            </div>
          )}
          {otherEntities.length > 0 && (
            <details>
              <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-600">
                Synchroniser d&apos;autres données (hors pages choisies)
              </summary>
              <div className="mt-2 flex flex-wrap gap-2">
                {otherEntities.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEndpoints((prev) => [...prev, emptyEndpoint(e)])}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-accent hover:text-accent"
                  >
                    ＋ {ENTITY_FIELDS[e].label}
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ── Couverture page par page (visibilité AVANT la 1re synchro) ── */}
      {pages.length > 0 && (
        <div className={`card p-4 ${incompletePages.length > 0 ? "border-amber-200/70 bg-amber-50/30" : "border-emerald-200/70 bg-emerald-50/30"}`}>
          <p className="text-sm font-semibold text-slate-900">🎯 État de couverture par page</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Ce que chaque page pourra calculer avec cet outil. Les rattachements « Outil source par page » et les
            agents correspondants sont appliqués à l&apos;enregistrement.
          </p>
          <div className="mt-3 space-y-2">
            {PAGE_REQUIREMENTS.filter((p) => pages.includes(p.key)).map((p) => {
              const missing = p.required.filter((r) => !configuredEntities.includes(r));
              const ready = missing.length === 0;
              return (
                <div key={p.key} className="rounded-lg border border-white bg-white/70 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-800">
                      {ready ? "✅" : "⚠️"} {p.label}
                      {p.agent && <span className="ml-2 font-normal text-slate-400">· {p.agent.label}</span>}
                    </p>
                    {!ready && (
                      <p className="text-[11px] font-medium text-amber-700">
                        Manque : {missing.map((m) => ENTITY_FIELDS[m].label).join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {ready ? "KPIs disponibles : " : "KPIs en attente : "}
                    {p.kpis.join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
          {incompletePages.length > 0 && (
            <p className="mt-2 text-[11px] text-amber-800">
              Tant qu&apos;une donnée obligatoire manque, la page reste vide pour cet outil — Revold n&apos;affichera
              jamais un chiffre partiel en le faisant passer pour complet.
            </p>
          )}
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
