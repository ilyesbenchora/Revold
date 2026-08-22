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

let active = 0;
let lastStart = 0;
const waiters: Array<() => void> = [];

async function acquire(): Promise<void> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active++;
  // Espacement des départs : lisse les rafales sous la fenêtre 100 req/10 s.
  const wait = lastStart + MIN_SPACING_MS - Date.now();
  lastStart = Math.max(Date.now(), lastStart + MIN_SPACING_MS);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

function release(): void {
  active--;
  waiters.shift()?.();
}

export async function hubFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  await acquire();
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
    release();
  }
}
