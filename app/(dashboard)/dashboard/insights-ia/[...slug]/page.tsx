import { redirect } from "next/navigation";

/** Anciennes pages de coachs (commercial, marketing, data…) → Mon équipe IA. */
export default function CoachCategoryRedirect() {
  redirect("/dashboard/audit");
}
