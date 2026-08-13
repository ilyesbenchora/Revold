import { redirect } from "next/navigation";

/**
 * L'onglet « Audit onboarding » a été fusionné dans la Vue d'ensemble
 * (blocs « Audit par outil » + « Plan d'action IA ») — on redirige les
 * anciens liens/favoris vers la page principale.
 */
export default function OnboardingAuditPage() {
  redirect("/dashboard/donnees");
}
