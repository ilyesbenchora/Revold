"use client";

/**
 * Paramètres → Tour de contrôle : mode d'emploi détaillé de l'orbe vocale de
 * la home, avec activation/désactivation par fonctionnalité et phrase de
 * brief personnalisable. Les réglages s'appliquent immédiatement à l'orbe
 * (localStorage partagé, événement `revold:tower-settings`).
 */

import { useCallback } from "react";
import {
  useTowerSettings,
  readTowerSettings,
  writeTowerSettings,
  DEFAULT_TOWER_SETTINGS,
  type TowerSettings,
} from "@/lib/voice/tower-settings";

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
  icon: string;
  title: string;
  on: boolean;
  onToggle: () => void;
  description: string;
  how: string;
  examples?: string[];
  children?: React.ReactNode;
};

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

export function TowerSettingsForm() {
  const settings = useTowerSettings();

  const set = useCallback(<K extends keyof TowerSettings>(key: K, value: TowerSettings[K]) => {
    writeTowerSettings({ ...readTowerSettings(), [key]: value });
  }, []);
  const flip = useCallback((key: keyof TowerSettings) => {
    const cur = readTowerSettings();
    writeTowerSettings({ ...cur, [key]: !cur[key] });
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
        <p className="mt-2 text-xs text-slate-500">
          La dictée utilise la reconnaissance vocale du navigateur (Chrome/Edge recommandés). Les réglages
          sont rattachés à ton compte : ils te suivent d&apos;un appareil à l&apos;autre. La tour de contrôle est
          disponible à partir du plan Growth.
        </p>
      </div>

      <FeatureCard
        icon="☀️"
        title="Brief vocal du jour"
        on={settings.brief}
        onToggle={() => flip("brief")}
        description="Un point de situation lu à voix haute, calculé en direct sur tes vraies données — sans IA générative, donc fiable et instantané."
        how="Le brief compile 4 choses : les alertes actives dont le seuil est réellement atteint, les objectifs en retard (moins de 60 % de progression à moins de 30 jours de l'échéance), les synchronisations d'outils en échec, et tes rendez-vous de coaching dans les 48 h. Il se lance avec le bouton « ☀️ Brief du jour » sous l'orbe, ou à la voix avec ta phrase personnalisée."
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
                ["briefAlerts", "🚨 Alertes en tension", "Alertes actives dont le seuil est atteint"],
                ["briefObjectives", "🎯 Objectifs en retard", "< 60 % de progression à ≤ 30 j de l'échéance"],
                ["briefSyncs", "🔄 Syncs en échec", "Dernier run de chaque outil connecté"],
                ["briefMeetings", "📅 RDV de coaching", "Séances prévues dans les 48 h"],
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
            </div>
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
        icon="🟢"
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
        how="Toutes les pages principales sont accessibles (Ventes, Marketing, Trésorerie, Service client, Équipes, Rapprochement données, alertes, objectifs, rapports, prévisions, coaching, paramètres…). Pour un rapport sauvegardé, cite son titre même approximativement : l'orbe le retrouve et fait défiler la page jusqu'à sa carte."
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
