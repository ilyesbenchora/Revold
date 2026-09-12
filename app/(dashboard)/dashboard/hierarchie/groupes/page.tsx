import { redirect } from "next/navigation";

/** Ancienne URL des groupes déclarés — devenus la page RACINE de la section. */
export default function GroupesRedirect() {
  redirect("/dashboard/hierarchie");
}
