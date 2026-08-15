import { redirect } from "next/navigation";

/**
 * L'ancienne section « Coachs IA » est supprimée : un seul roster d'agents
 * (Mon équipe IA), qui porte désormais la mécanique de séance (mémoire,
 * engagements, style, plan). Le cadrage en amont vit dans Suivi → Séances.
 */
export default function CoachsRedirect() {
  redirect("/dashboard/audit");
}
