"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeactivateReportButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDeactivate() {
    setBusy(true);
    await fetch(`/api/reports/activate?reportId=${encodeURIComponent(reportId)}`, {
      method: "DELETE",
    });
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={handleDeactivate}
      className="text-xs font-medium text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
    >
      {busy ? "Désactivation..." : "Désactiver"}
    </button>
  );
}
