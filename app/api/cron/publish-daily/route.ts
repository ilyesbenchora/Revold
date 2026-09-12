import { NextResponse } from "next/server";
import { articles } from "@/app/blog/data";
import { todayParis } from "@/app/blog/published";
import { SITE_URL } from "@/lib/seo/site";
import { pingWebSub, postToLinkedIn, submitIndexNow, RSS_URL, type HookResult } from "@/lib/seo/publish-hooks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cron quotidien de DIFFUSION des publications (vercel.json, 06:15 UTC) :
 * pour chaque article dont la date de publication est AUJOURD'HUI (heure de
 * Paris), soumet l'URL à IndexNow (Bing / ChatGPT search), pingue le hub
 * WebSub du flux RSS (Feedly, Inoreader…) et publie sur la page LinkedIn si
 * les jetons sont configurés. Idempotent à la journée : rejouer le cron le
 * même jour republie les mêmes canaux — IndexNow et WebSub tolèrent les
 * doublons ; LinkedIn est protégé par `?force=1` absent (voir plus bas).
 *
 * Auth : CRON_SECRET en Authorization Bearer. `?date=YYYY-MM-DD` permet de
 * rejouer une date (tests) ; `?linkedin=0` désactive le post LinkedIn.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") ?? "") ? (url.searchParams.get("date") as string) : todayParis();
  const withLinkedIn = url.searchParams.get("linkedin") !== "0";

  const today = articles.filter((a) => a.date === day);
  if (today.length === 0) {
    return NextResponse.json({ day, published: 0, results: [] as HookResult[] });
  }

  const urls = today.map((a) => `${SITE_URL}/blog/${a.slug}`);
  const results: HookResult[] = [];
  results.push(await submitIndexNow([...urls, RSS_URL, `${SITE_URL}/blog`, `${SITE_URL}/sitemap.xml`]));
  results.push(await pingWebSub());
  if (withLinkedIn) {
    for (const a of today) {
      results.push(await postToLinkedIn({ title: a.title, description: a.description, url: `${SITE_URL}/blog/${a.slug}` }));
    }
  }
  return NextResponse.json({ day, published: today.length, urls, results });
}
