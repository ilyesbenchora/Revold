export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function ParametresIndexPage() {
  redirect("/dashboard/parametres/general");
}
