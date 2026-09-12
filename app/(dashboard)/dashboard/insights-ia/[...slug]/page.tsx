import { redirect } from "next/navigation";

/** Anciennes pages de coachs (commercial, marketing, data…) → équipe IA (home). */
export default function CoachCategoryRedirect() {
  redirect("/dashboard");
}
