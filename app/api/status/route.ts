import { NextResponse } from "next/server";
import { computePlatformStatus } from "@/lib/status/compute";

export const dynamic = "force-dynamic";

/**
 * Statut public de la plateforme (JSON) — consommé par la page /statut et
 * utilisable par un monitoring externe. Sans authentification : le contenu est
 * assaini (aucun détail interne, aucune donnée d'organisation). Caché 60 s au
 * CDN pour encaisser le trafic sans marteler la base.
 */
export async function GET() {
  const status = await computePlatformStatus();
  return NextResponse.json(status, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
  });
}
