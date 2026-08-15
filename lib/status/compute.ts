import { createClient } from "@supabase/supabase-js";

/**
 * Statut PUBLIC de la plateforme — calculé depuis cron_runs (monitoring des
 * crons) et AGRÉGÉ en systèmes lisibles par un visiteur. Volontairement
 * assaini : aucun message d'erreur interne, aucune donnée d'organisation —
 * uniquement « opérationnel / dégradé / initialisation » et la fraîcheur.
 *
 * Utilisé par /api/status (JSON, caché 60 s) et la page /statut.
 */

export type SystemHealth = "operational" | "degraded" | "unknown";

export type StatusSystem = {
  key: string;
  label: string;
  description: string;
  status: SystemHealth;
  /** Dernière exécution réussie du système (max de ses crons). */
  lastOkAt: string | null;
};

export type PlatformStatus = {
  overall: SystemHealth;
  systems: StatusSystem[];
  checkedAt: string;
};

// Systèmes affichés publiquement ← crons internes qui les portent (cadence en
// minutes, alignée sur vercel.json). Un cron est sain si son dernier run est un
// succès ET date de moins de 2× sa cadence.
const SYSTEMS: { key: string; label: string; description: string; crons: Record<string, number> }[] = [
  {
    key: "sync",
    label: "Synchronisation des données",
    description: "HubSpot, facturation et connecteurs — fraîcheur des données sources",
    crons: { "etl-delta": 30, "sync-connectors": 60 },
  },
  {
    key: "kpis",
    label: "Calcul des indicateurs",
    description: "KPIs, taux de complétude et agrégats déterministes",
    crons: { "compute-fill-rates": 6 * 60 },
  },
  {
    key: "alerts",
    label: "Alertes & objectifs",
    description: "Surveillance des seuils et progression des objectifs",
    crons: { "check-alerts": 6 * 60, "check-objectives": 6 * 60 },
  },
  {
    key: "routines",
    label: "Routines des agents",
    description: "Rapports programmés, générés côté serveur",
    crons: { "run-routines": 15 },
  },
  {
    key: "digest",
    label: "Notifications & digest",
    description: "Notifications in-app et récapitulatif quotidien",
    crons: { "daily-digest": 24 * 60 },
  },
];

type Run = { cron: string; status: string; started_at: string };

function cronHealth(runs: Run[], cron: string, intervalMin: number, now: number): { health: SystemHealth; lastOkAt: string | null } {
  const mine = runs.filter((r) => r.cron === cron);
  if (mine.length === 0) return { health: "unknown", lastOkAt: null }; // jamais tourné (déploiement récent)
  const last = mine[0];
  const lastOk = mine.find((r) => r.status === "ok") ?? null;
  const fresh = lastOk !== null && now - Date.parse(lastOk.started_at) <= intervalMin * 2 * 60_000;
  // Dégradé si le dernier run a échoué OU si aucun succès récent.
  const health: SystemHealth = last.status === "failed" || !fresh ? "degraded" : "operational";
  return { health, lastOkAt: lastOk?.started_at ?? null };
}

export async function computePlatformStatus(): Promise<PlatformStatus> {
  const checkedAt = new Date().toISOString();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let runs: Run[] = [];
  if (url && key) {
    try {
      const sb = createClient(url, key);
      const { data } = await sb
        .from("cron_runs")
        .select("cron, status, started_at")
        .order("started_at", { ascending: false })
        .limit(300);
      runs = (data ?? []) as Run[];
    } catch {
      /* base injoignable → tous les systèmes en "unknown", jamais d'erreur publique */
    }
  }

  const now = Date.now();
  const systems: StatusSystem[] = SYSTEMS.map((s) => {
    const parts = Object.entries(s.crons).map(([cron, interval]) => cronHealth(runs, cron, interval, now));
    // Le système prend le pire état de ses crons ; "unknown" seulement si AUCUN n'a tourné.
    const status: SystemHealth = parts.some((p) => p.health === "degraded")
      ? "degraded"
      : parts.every((p) => p.health === "unknown")
        ? "unknown"
        : "operational";
    const lastOkAt = parts
      .map((p) => p.lastOkAt)
      .filter((d): d is string => !!d)
      .sort()
      .pop() ?? null;
    return { key: s.key, label: s.label, description: s.description, status, lastOkAt };
  });

  const overall: SystemHealth = systems.some((s) => s.status === "degraded")
    ? "degraded"
    : systems.every((s) => s.status === "unknown")
      ? "unknown"
      : "operational";

  return { overall, systems, checkedAt };
}
