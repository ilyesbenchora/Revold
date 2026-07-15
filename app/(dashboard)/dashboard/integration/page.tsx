import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Intégrations est désormais un menu à 3 pages : on redirige vers « Mes outils connectés ». */
export default function IntegrationIndex() {
  redirect("/dashboard/integration/mes-outils");
}
