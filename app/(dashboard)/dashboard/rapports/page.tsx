export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function RapportsIndexPage() {
  redirect("/dashboard/rapports/mes-rapports");
}
