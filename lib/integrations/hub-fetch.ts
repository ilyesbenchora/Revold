/**
 * fetch THROTTLÉ pour l'API HubSpot — remplace tout fetch(api.hubapi.com) direct.
 *
 * HubSpot limite les apps OAuth à ~100 requêtes / 10 s par portail : quand
 * plusieurs pages chargent en parallèle (ou juste après une connexion, sync
 * initiale + snapshot), les rafales déclenchaient des 429 visibles dans l'UI.
 * Ici, dans chaque instance serveur :
 *  - au plus 8 requêtes HubSpot CONCURRENTES (les autres attendent leur tour) ;
 *  - espacement minimal de 60 ms entre départs de requêtes ;
 *  - retry automatique sur 429 : Retry-After respecté, sinon backoff
 *    exponentiel (0,8 s → 1,6 s → 3,2 s), 3 tentatives avant de rendre le 429.
 *
 * Signature identique à fetch : remplacement drop-in.
 */

const MAX_CONCURRENT = 8;
const MIN_SPACING_MS = 60;
const MAX_RETRIES = 3;

// Limiteur PAR PORTAIL (clé = token du header Authorization) : les quotas
// HubSpot sont par portail — plusieurs portails connectés (une org Revold
// chacun) ne partagent pas leur fenêtre 100 req/10 s, donc chacun a son
// propre couloir de 8 requêtes ; le trafic d'un portail ne ralentit pas les
// autres. Requêtes sans token (OAuth/token exchange) → couloir « default ».
type Lane = { active: number; lastStart: number; waiters: Array<() => void> };
const lanes = new Map<string, Lane>();

function laneKey(init?: RequestInit): string {
  const h = init?.headers;
  let auth = "";
  if (h instanceof Headers) auth = h.get("Authorization") ?? "";
  else if (h && typeof h === "object") auth = (h as Record<string, string>).Authorization ?? "";
  // Fin du token : suffit à distinguer les portails sans garder le secret entier.
  return auth ? auth.slice(-24) : "default";
}

async function acquire(lane: Lane): Promise<void> {
  if (lane.active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => lane.waiters.push(resolve));
  }
  lane.active++;
  // Espacement des départs : lisse les rafales sous la fenêtre 100 req/10 s.
  const wait = lane.lastStart + MIN_SPACING_MS - Date.now();
  lane.lastStart = Math.max(Date.now(), lane.lastStart + MIN_SPACING_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function release(lane: Lane): void {
  lane.active--;
  lane.waiters.shift()?.();
}

export async function hubFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const key = laneKey(init);
  let lane = lanes.get(key);
  if (!lane) {
    lane = { active: 0, lastStart: 0, waiters: [] };
    lanes.set(key, lane);
    // Borne mémoire : on ne garde que les ~50 derniers couloirs.
    if (lanes.size > 50) {
      const first = lanes.keys().next().value;
      if (first !== undefined && first !== key) lanes.delete(first);
    }
  }
  await acquire(lane);
  try {
    let res = await fetch(input, init);
    for (let attempt = 0; res.status === 429 && attempt < MAX_RETRIES; attempt++) {
      const retryAfter = res.headers.get("Retry-After");
      const wait = retryAfter
        ? Math.min((parseInt(retryAfter, 10) || 1) * 1000, 30_000)
        : 800 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      res = await fetch(input, init);
    }
    return res;
  } finally {
    release(lane);
  }
}
