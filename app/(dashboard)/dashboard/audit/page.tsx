import { redirect } from "next/navigation";

/**
 * « Mon équipe IA » n'est plus une page dédiée : l'équipe d'agents (avatars,
 * objectifs et insights) vit désormais sur la Vue d'ensemble (home). On
 * redirige les anciens liens entrants vers la home. Les sous-pages de la
 * section Données (Trésorerie, Service client…) restent, elles, inchangées.
 */
export default function AuditPage() {
  redirect("/dashboard");
}
