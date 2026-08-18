"use client";

/**
 * Paramètres → Tour de contrôle : mode d'emploi détaillé de l'orbe vocale de
 * la home, avec activation/désactivation par fonctionnalité et phrase de
 * brief personnalisable. Les réglages s'appliquent immédiatement à l'orbe
 * (localStorage partagé, événement `revold:tower-settings`).
 */

import { useCallback, useEffect, useState } from "react";
import {
  useTowerSettings,
  readTowerSettings,
  writeTowerSettings,
  DEFAULT_TOWER_SETTINGS,
  type TowerSettings,
  type BriefCustomItem,
} from "@/lib/voice/tower-settings";
import { entityLabel, dimLabel, ENTITY_SOURCE_CATEGORY } from "@/lib/reports/data-table-presets";

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${on ? "bg-accent" : "bg-slate-300"}`}
    >
      <span className={`inline-block rounded-full bg-white shadow transition-all ${on ? "translate-x-[1.4rem]" : "translate-x-1"}`} style={{ height: 18, width: 18 }} />
    </button>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-600">
      « {children} »
    </span>
  );
}

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  on: boolean;
  onToggle: () => void;
  description: string;
  how: string;
  examples?: string[];
  children?: React.ReactNode;
};

/**
 * Boule de la tour de contrôle en miniature — fidèle au rendu canvas de la
 * home : disque sombre, halo doré diffus, sphère de PARTICULES dorées
 * (rgba(250,210,120)) et anneau de santé vert à l'intérieur du bord.
 */
function MiniOrb() {
  return (
    <span aria-hidden className="mt-0.5 inline-flex h-6 w-6 shrink-0">
      <svg viewBox="0 0 24 24" className="h-full w-full">
        <defs>
          <radialGradient id="miniOrbGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="rgba(253,224,150,0.55)" />
            <stop offset="55%" stopColor="rgba(245,190,90,0.18)" />
            <stop offset="100%" stopColor="rgba(245,190,90,0)" />
          </radialGradient>
        </defs>
        {/* Fond sombre de la carte tour de contrôle */}
        <circle cx="12" cy="12" r="11" fill="#0f172a" />
        {/* Halo / cœur lumineux doré */}
        <circle cx="12" cy="12" r="11" fill="url(#miniOrbGlow)" />
        {/* Particules dorées de la sphère */}
        <g fill="#fad278">
          <circle cx="12" cy="6.2" r="0.65" opacity="0.9" />
          <circle cx="16.4" cy="7.8" r="0.75" opacity="0.85" />
          <circle cx="17.8" cy="12" r="0.65" opacity="0.7" />
          <circle cx="16.2" cy="16.1" r="0.75" opacity="0.9" />
          <circle cx="12" cy="17.8" r="0.65" opacity="0.8" />
          <circle cx="7.8" cy="16.2" r="0.75" opacity="0.85" />
          <circle cx="6.2" cy="12" r="0.65" opacity="0.7" />
          <circle cx="7.6" cy="8" r="0.75" opacity="0.9" />
          <circle cx="10.3" cy="10.1" r="0.85" opacity="1" />
          <circle cx="13.9" cy="9.5" r="0.75" opacity="0.95" />
          <circle cx="14.5" cy="13.7" r="0.85" opacity="0.9" />
          <circle cx="9.7" cy="14.3" r="0.75" opacity="0.95" />
          <circle cx="12.2" cy="12" r="0.95" opacity="1" />
        </g>
        {/* Anneau de santé (vert = tout va bien), à l'intérieur du bord comme sur la home */}
        <circle cx="12" cy="12" r="9" fill="none" stroke="#34d399" strokeWidth="1" opacity="0.8" />
      </svg>
    </span>
  );
}

function FeatureCard({ icon, title, on, onToggle, description, how, examples, children }: FeatureCardProps) {
  return (
    <article className={`card p-5 transition ${on ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl" aria-hidden>{icon}</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>
          </div>
        </div>
        <Toggle on={on} onClick={onToggle} label={title} />
      </div>
      <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
        <span className="font-semibold text-slate-700">Comment ça marche : </span>
        {how}
      </p>
      {examples && examples.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-slate-500">Exemples :</span>
          {examples.map((e) => <Chip key={e}>{e}</Chip>)}
        </div>
      )}
      {children}
    </article>
  );
}

/**
 * Ajout d'une donnée personnalisée au brief : mini funnel de CÂBLAGE — l'agent
 * propose la source de données, le total est recalculé sur les vraies données
 * avant validation. Même exigence de fiabilité que les tables de données.
 */
function AddCustomBriefData({ onAdd }: { onAdd: (item: BriefCustomItem) => void }) {
  const [open, setOpen] = useState(false);
  const [kpi, setKpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<{
    entity: string; group_by: string; measure: string; field: string | null; unit_mode: string; title: string | null;
  } | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState(0);
  // Outils connectés — pour afficher sur QUEL outil le KPI est câblé.
  const [tools, setTools] = useState<{ key: string; label: string; category: string }[]>([]);
  useEffect(() => {
    if (!open || tools.length > 0) return;
    let alive = true;
    fetch("/api/integrations/connected")
      .then((r) => (r.ok ? r.json() : { tools: [] }))
      .then((d) => { if (alive && Array.isArray(d.tools)) setTools(d.tools); })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    setOpen(false); setKpi(""); setProposal(null); setTotal(null); setRowCount(0); setError(null);
  }

  async function verify() {
    if (loading || !kpi.trim()) return;
    setLoading(true); setError(null); setProposal(null);
    try {
      const res = await fetch("/api/page-tables/agent-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_key: "audit_donnees", custom_kpi: kpi.trim(), sources: [] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.proposal) throw new Error(d.error || "Câblage impossible — reformule le KPI.");
      const p = d.proposal as { entity: string; group_by: string; measure: string; field: string | null; unit_mode: string; title: string | null };
      const rec = await fetch("/api/reports/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: { entity: p.entity, groupBy: p.group_by, measure: p.measure, field: p.field },
          sources: [],
          all: true,
        }),
      });
      const rd = await rec.json().catch(() => ({}));
      if (!rec.ok || !Array.isArray(rd.data)) throw new Error(rd.error || "Recalcul impossible.");
      const rows = rd.data as { value?: number }[];
      setProposal(p);
      setRowCount(rows.length);
      setTotal(rows.reduce((s, r) => s + (Number(r.value) || 0), 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!proposal) return;
    onAdd({
      id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `bc_${Date.now()}`,
      label: proposal.title || kpi.trim(),
      enabled: true,
      unit: proposal.unit_mode ?? null,
      query: { entity: proposal.entity, groupBy: proposal.group_by, measure: proposal.measure, field: proposal.field },
    });
    reset();
  }

  const fmt = (v: number) =>
    proposal?.unit_mode === "currency"
      ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v)
      : proposal?.unit_mode === "percent"
        ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} %`
        : new Intl.NumberFormat("fr-FR").format(v);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 w-full rounded-md border border-dashed border-accent/40 bg-white px-2.5 py-2 text-[11px] font-semibold text-accent transition hover:bg-indigo-50/40"
      >
        ＋ Ajouter une donnée personnalisée (câblage vérifié)
      </button>
    );
  }
  return (
    <div className="mt-2 rounded-md border border-dashed border-accent/40 bg-white p-2.5">
      <p className="text-[11px] font-semibold text-accent">Ajouter une donnée personnalisée au brief</p>
      <p className="mt-0.5 text-[10px] text-slate-500">
        Décris le KPI — le câblage est vérifié sur tes données réelles avant validation.
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <input
          value={kpi}
          onChange={(e) => setKpi(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") verify(); }}
          placeholder="Ex : nombre de deals ouverts, MRR total…"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={verify}
          disabled={loading || !kpi.trim()}
          className="rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Câblage…" : "Vérifier"}
        </button>
        <button type="button" onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600">Annuler</button>
      </div>
      {error && <p className="mt-1.5 rounded bg-rose-50 px-2 py-1.5 text-[10px] text-rose-600">{error}</p>}
      {proposal && total !== null && (
        <div className="mt-2 rounded-md border border-accent/30 bg-indigo-50/40 p-2">
          <p className="text-[11px] text-slate-700">
            <span className="font-semibold">{proposal.title || kpi}</span> — {entityLabel(proposal.entity)} par{" "}
            {dimLabel(proposal.entity, proposal.group_by).toLowerCase()}
            {(() => {
              // Outil(s) de câblage : les outils connectés qui alimentent l'entité.
              const wired = tools.filter((t) => t.category === ENTITY_SOURCE_CATEGORY[proposal.entity]);
              return wired.length > 0 ? (
                <> · câblé sur <span className="font-semibold">{wired.map((t) => t.label).join(" · ")}</span></>
              ) : null;
            })()}{" "}
            ·{" "}
            <span className={rowCount > 0 ? "font-semibold text-emerald-600" : "font-semibold text-rose-500"}>
              {rowCount} ligne{rowCount > 1 ? "s" : ""} · total {fmt(total)}
            </span>
          </p>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={confirm}
              disabled={rowCount === 0}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              ✓ Valider — l&apos;ajouter au brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TowerSettingsForm() {
  const settings = useTowerSettings();

  const set = useCallback(<K extends keyof TowerSettings>(key: K, value: TowerSettings[K]) => {
    writeTowerSettings({ ...readTowerSettings(), [key]: value });
  }, []);
  const flip = useCallback((key: keyof TowerSettings) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, [key]: !cur[key] });
  }, []);

  // ── Données personnalisées du brief (KPIs câblés) ──
  const toggleCustom = useCallback((id: string) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, briefCustom: cur.briefCustom.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)) });
  }, []);
  const removeCustom = useCallback((id: string) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, briefCustom: cur.briefCustom.filter((i) => i.id !== id) });
  }, []);
  const addCustom = useCallback((item: BriefCustomItem) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, briefCustom: [...cur.briefCustom, item].slice(0, 12) });
  }, []);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="card border-l-4 border-l-accent p-5">
        <h2 className="text-base font-semibold text-slate-900">Comment fonctionne la tour de contrôle</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          L&apos;orbe dorée de la page d&apos;accueil est ton copilote 100&nbsp;% vocal&nbsp;: clique dessus, dicte ta
          demande, et elle choisit la bonne action — répondre directement, briefer l&apos;agent ou le coach
          compétent (tu arrives sur son chat avec la réponse en cours), créer une alerte ou un objectif,
          ouvrir une page ou un rapport, ou lire ton brief du jour. Chaque fonctionnalité se désactive
          ci-dessous si tu préfères une orbe plus simple&nbsp;; les réglages s&apos;appliquent immédiatement.
        </p>
        {/* Note technique uniquement — la disponibilité par plan est portée par
            la variante verrouillée de l'orbe (Starter), pas par ce mode d'emploi. */}
        <p className="mt-2 text-xs text-slate-500">
          La dictée utilise la reconnaissance vocale du navigateur (Chrome/Edge recommandés). Les réglages
          sont rattachés à ton compte : ils te suivent d&apos;un appareil à l&apos;autre.
        </p>
      </div>

      <FeatureCard
        icon="☀️"
        title="Brief vocal du jour"
        on={settings.brief}
        onToggle={() => flip("brief")}
        description="Un point de situation lu à voix haute, calculé en direct sur tes vraies données — sans IA générative, donc fiable et instantané."
        how="Le brief annonce chaque famille de données puis donne les chiffres : alertes en tension (valeur actuelle face au seuil, alertes techniques comprises), radar de facturation (nombre de factures attendues et montant, clients concernés), objectifs en retard ou atteints (progression chiffrée et échéance), synchronisations en échec, enrichissement et actions exécutées. Il se lance avec le bouton « Brief du jour » sous l'orbe, ou à la voix avec ta phrase personnalisée."
        examples={[settings.briefPhrase || "quoi de neuf", "fais-moi le point", "mon brief du matin"]}
      >
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="brief-phrase" className="text-xs font-medium text-slate-700">
              Phrase qui déclenche le brief à la voix
            </label>
            <input
              id="brief-phrase"
              type="text"
              value={settings.briefPhrase}
              onChange={(e) => set("briefPhrase", e.target.value.slice(0, 60))}
              onBlur={(e) => { if (!e.target.value.trim()) set("briefPhrase", DEFAULT_TOWER_SETTINGS.briefPhrase); }}
              placeholder="quoi de neuf"
              className="w-56 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-accent"
            />
          </div>
          <p className="text-[11px] text-slate-500">
            Dès que ta dictée contient cette phrase (accents et majuscules ignorés), le brief part
            directement — sans passer par le routeur IA.
          </p>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700">Contenu du brief</p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Choisis les données que le brief te lit. L&apos;anneau de santé, lui, surveille toujours tout.
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([
                ["briefAlerts", "Alertes en tension", "Valeur actuelle face au seuil, alertes techniques comprises"],
                ["briefRadar", "Radar de facturation", "Nombre, montant estimé et clients concernés"],
                ["briefObjectives", "Objectifs en retard", "Progression chiffrée et échéance (< 60 % à ≤ 30 j)"],
                ["briefObjectivesReached", "Objectifs atteints", "Valeur atteinte face à la cible (≥ 100 %)"],
                ["briefSyncs", "Syncs en échec", "Outil et date du dernier run en échec"],
                ["briefEnrichment", "Enrichissement terminé", "Le robot a fini d'enrichir la base (SIREN, effectifs, CA)"],
                ["briefActionsDone", "Actions faites", "Actions exécutées dans tes outils sur les dernières 24 h"],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-2 transition hover:border-accent/40">
                  <input
                    type="checkbox"
                    checked={settings[key]}
                    onChange={() => flip(key)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span>
                    <span className="block text-xs font-medium text-slate-800">{label}</span>
                    <span className="block text-[10px] text-slate-500">{hint}</span>
                  </span>
                </label>
              ))}
              {/* Données personnalisées : même typologie de bloc que les sections natives. */}
              {settings.briefCustom.map((item) => (
                <label
                  key={item.id}
                  className="group relative flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-white p-2 transition hover:border-accent/40"
                >
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleCustom(item.id)}
                    className="mt-0.5 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 pr-4">
                    <span className="block truncate text-xs font-medium text-slate-800">{item.label}</span>
                    <span className="block text-[10px] text-slate-500">
                      KPI personnalisé · {entityLabel(item.query.entity)} par {dimLabel(item.query.entity, item.query.groupBy).toLowerCase()} — recalculé à chaque brief
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); removeCustom(item.id); }}
                    title="Retirer cette donnée du brief"
                    className="absolute right-1.5 top-1.5 hidden rounded-full px-1 text-[10px] text-slate-400 transition hover:text-rose-600 group-hover:block"
                  >
                    ✕
                  </button>
                </label>
              ))}
            </div>
            <AddCustomBriefData onAdd={addCustom} />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-3">
            <div>
              <p className="text-xs font-semibold text-slate-700">🌙 Mode veille</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                En vacances ou en déplacement&nbsp;? Le brief ne remonte plus QUE les exceptions — alertes en
                tension et synchronisations en échec. Si tout va bien, il dit simplement «&nbsp;tout est au
                vert&nbsp;». Aussi accessible via le toggle «&nbsp;Veille&nbsp;» sous l&apos;orbe.
              </p>
            </div>
            <Toggle on={settings.veille} onClick={() => flip("veille")} label="Mode veille" />
          </div>
        </div>
      </FeatureCard>

      <FeatureCard
        icon="💡"
        title="Réponse directe aux questions simples"
        on={settings.quickAnswer}
        onToggle={() => flip("quickAnswer")}
        description="Pour une question chiffrée simple, l'orbe répond immédiatement à l'oral — sans t'envoyer vers un agent."
        how="La valeur est calculée à l'instant par le même moteur que tes alertes (KPIs du catalogue : MRR, MQL, deals ouverts, taux de conversion…), puis énoncée à voix haute. Un bouton « Creuser avec l'agent » apparaît si tu veux l'analyse complète. Désactivée, toutes les questions partent vers l'agent compétent."
        examples={["combien de MQL ce mois-ci ?", "c'est quoi mon MRR ?", "combien de deals ouverts ?"]}
      />

      <FeatureCard
        icon="🔔"
        title="Création vocale d'alertes et d'objectifs"
        on={settings.createActions}
        onToggle={() => flip("createActions")}
        description="Dicte une alerte de seuil ou un objectif chiffré : l'orbe le prépare et te le fait valider avant de créer quoi que ce soit."
        how="L'orbe reformule ta demande (KPI, seuil ou cible, direction, échéance), la résume à l'oral et affiche deux boutons Valider / Annuler sous l'orbe. Rien n'est créé sans ton clic. Une fois validée, l'alerte ou l'objectif rejoint Mes alertes / Objectifs et est suivi automatiquement comme les autres."
        examples={["préviens-moi si le MRR passe sous 10 000 €", "objectif de 50 deals signés d'ici fin septembre"]}
      />

      <FeatureCard
        icon={<MiniOrb />}
        title="Anneau de santé"
        on={settings.healthRing}
        onToggle={() => flip("healthRing")}
        description="L'anneau autour de l'orbe change de couleur selon l'état réel de ton compte — un coup d'œil suffit."
        how="Au chargement de la home : vert = tout va bien ; ambre = points de vigilance (alertes en tension ou objectifs en retard) ; rouge pulsant = situation critique (alerte critique déclenchée ou synchronisation d'outil en échec). Survole l'orbe pour un indice, demande ton brief pour le détail."
      />

      <FeatureCard
        icon="🧭"
        title="Navigation vocale"
        on={settings.navigation}
        onToggle={() => flip("navigation")}
        description="Déplace-toi dans toute la plateforme à la voix — pages et rapports sauvegardés."
        how="Toutes les pages principales sont accessibles (Ventes, Marketing, Trésorerie, Service client, Équipes, Rapprochement données, alertes, objectifs, rapports, prévisions, paramètres…). Pour un rapport sauvegardé, cite son titre même approximativement : l'orbe le retrouve et fait défiler la page jusqu'à sa carte."
        examples={["ouvre la trésorerie", "montre mes objectifs", "ouvre le rapport pipeline par étape"]}
      />

      <FeatureCard
        icon="🗂️"
        title="File d'exécution multi-agents"
        on={settings.queue}
        onToggle={() => flip("queue")}
        description="Enchaîne plusieurs demandes dans une seule phrase : chacune est briefée à l'agent compétent, l'une après l'autre."
        how="La première demande s'ouvre immédiatement sur le chat de l'agent. Les suivantes attendent dans une pastille en bas à droite, visible sur tout le dashboard : un clic sur « Briefer <agent> → » lance la suivante quand tu es prêt. Désactivée, seule la première demande d'une phrase est traitée."
        examples={["demande à Maya d'analyser le funnel et à Karim de vérifier les taux de rapprochement"]}
      />

      <FeatureCard
        icon="🧠"
        title="Mémoire de contexte"
        on={settings.memory}
        onToggle={() => flip("memory")}
        description="L'orbe se souvient de tes 3 derniers échanges vocaux pour comprendre les enchaînements."
        how="Après « combien de MQL ce mois-ci ? », tu peux dire « et par rapport au mois dernier ? » ou « crée une alerte dessus » sans répéter le sujet. La mémoire vit le temps de ta session de navigation (elle s'efface à la fermeture de l'onglet) et n'est jamais stockée sur nos serveurs."
        examples={["et par rapport au mois dernier ?", "crée une alerte dessus"]}
      />
    </div>
  );
}
