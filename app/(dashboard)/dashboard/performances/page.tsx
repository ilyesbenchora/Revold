export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WORKSPACE_COOKIE } from "@/lib/workspaces";

/**
 * Index Performances : redirige vers la sous-page du pôle. L'espace Marketing
 * atterrit sur Marketing (Ventes ne lui appartient pas) ; les autres espaces
 * sur Ventes.
 */
export default async function PerformancesIndexPage() {
  const ws = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  redirect(ws === "marketing" ? "/dashboard/performances/marketing" : "/dashboard/performances/commerciale");
}
