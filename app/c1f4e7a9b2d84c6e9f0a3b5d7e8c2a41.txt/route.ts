import { INDEXNOW_KEY } from "@/lib/seo/publish-hooks";

/** Fichier de clé IndexNow : prouve la propriété du site (voir lib/seo/publish-hooks.ts). */
export async function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
