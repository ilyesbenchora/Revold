import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api/keys";

export const dynamic = "force-dynamic";

/** GET /api/v1/ping — vérifie une clé d'API (Authorization: Bearer rvk_…). */
export async function GET(request: Request) {
  const orgId = await authenticateApiKey(request);
  if (!orgId) return NextResponse.json({ error: "Clé d'API invalide ou révoquée" }, { status: 401 });
  return NextResponse.json({ ok: true, organization_id: orgId });
}
