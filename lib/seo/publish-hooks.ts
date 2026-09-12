/**
 * Diffusion AUTOMATIQUE des publications du blog — appelée par le cron
 * quotidien (app/api/cron/publish-daily) le jour où un article programmé
 * paraît (published.ts). Trois canaux, chacun best-effort et indépendant :
 *
 *  1. IndexNow (Bing, Yandex, Seznam… ; Bing alimente ChatGPT search et
 *     Copilot) : soumission immédiate des nouvelles URLs. Clé hébergée à
 *     /<clé>.txt (app/<clé>.txt/route.ts) — la clé n'est pas un secret, elle
 *     prouve seulement que le site nous appartient.
 *  2. WebSub (PubSubHubbub) : ping du hub public pour que les lecteurs RSS
 *     (Feedly, Inoreader…) récupèrent le flux sans attendre leur prochain
 *     passage. Le flux déclare le hub dans <atom:link rel="hub">.
 *  3. LinkedIn (page entreprise) : un post par article via l'API Community
 *     Management, si LINKEDIN_PAGE_ACCESS_TOKEN et LINKEDIN_ORGANIZATION_URN
 *     sont posés. Sans eux, le canal est simplement ignoré (jamais d'erreur).
 */

import { SITE_URL } from "@/lib/seo/site";

/** Clé IndexNow (8–128 caractères [a-zA-Z0-9-]) — servie par app/<clé>.txt. */
export const INDEXNOW_KEY = "c1f4e7a9b2d84c6e9f0a3b5d7e8c2a41";
export const RSS_URL = `${SITE_URL}/blog/rss.xml`;
export const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/";

export type HookResult = { channel: string; ok: boolean; detail: string };

/** Soumet des URLs à IndexNow (une requête pour toutes). */
export async function submitIndexNow(urls: string[]): Promise<HookResult> {
  if (urls.length === 0) return { channel: "indexnow", ok: true, detail: "aucune URL" };
  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE_URL).host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urls.slice(0, 10000),
      }),
    });
    // 200 / 202 = accepté ; 422 = clé invalide ; 429 = quota.
    return { channel: "indexnow", ok: res.status === 200 || res.status === 202, detail: `${urls.length} URL(s) → HTTP ${res.status}` };
  } catch (e) {
    return { channel: "indexnow", ok: false, detail: e instanceof Error ? e.message : "erreur réseau" };
  }
}

/** Ping WebSub : le hub va relire le flux et notifier les abonnés. */
export async function pingWebSub(feedUrl: string = RSS_URL): Promise<HookResult> {
  try {
    const body = new URLSearchParams({ "hub.mode": "publish", "hub.url": feedUrl });
    const res = await fetch(WEBSUB_HUB, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    return { channel: "websub", ok: res.status === 204 || res.status === 200 || res.status === 202, detail: `HTTP ${res.status}` };
  } catch (e) {
    return { channel: "websub", ok: false, detail: e instanceof Error ? e.message : "erreur réseau" };
  }
}

/**
 * Post LinkedIn sur la page entreprise (API Posts, Community Management).
 * Requiert un jeton d'un administrateur de la page avec le scope
 * w_organization_social, et l'URN de l'organisation (urn:li:organization:ID).
 */
export async function postToLinkedIn(input: { title: string; description: string; url: string }): Promise<HookResult> {
  const token = process.env.LINKEDIN_PAGE_ACCESS_TOKEN;
  const org = process.env.LINKEDIN_ORGANIZATION_URN;
  if (!token || !org) return { channel: "linkedin", ok: true, detail: "non configuré (LINKEDIN_PAGE_ACCESS_TOKEN / LINKEDIN_ORGANIZATION_URN absents)" };
  const commentary = `${input.title}\n\n${input.description}\n\n${input.url}`;
  try {
    const res = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
        "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202508",
      },
      body: JSON.stringify({
        author: org,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        content: { article: { source: input.url, title: input.title, description: input.description.slice(0, 250) } },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    const text = res.ok ? "" : await res.text().catch(() => "");
    return { channel: "linkedin", ok: res.ok, detail: `HTTP ${res.status}${text ? ` ${text.slice(0, 200)}` : ""}` };
  } catch (e) {
    return { channel: "linkedin", ok: false, detail: e instanceof Error ? e.message : "erreur réseau" };
  }
}
