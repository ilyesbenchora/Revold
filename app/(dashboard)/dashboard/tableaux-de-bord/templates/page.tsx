import { redirect } from "next/navigation";

/** La page Templates a déménagé : page à part du Dashboard (sidebar). */
export default function LegacyBoardTemplatesRedirect() {
  redirect("/dashboard/templates");
}
