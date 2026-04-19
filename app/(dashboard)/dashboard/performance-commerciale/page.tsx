export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";

export default function OldSalesPage() {
  redirect("/dashboard/performances/commerciale");
}
