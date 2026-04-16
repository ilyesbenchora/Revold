"use client";

import { useRouter, useSearchParams } from "next/navigation";

const options = [
  { value: "5", label: "5 jours" },
  { value: "10", label: "10 jours" },
  { value: "15", label: "15 jours" },
  { value: "30", label: "30 jours" },
  { value: "60", label: "60 jours" },
  { value: "90", label: "90 jours" },
];

export function StaleDaysSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("days") || "10";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", value);
    router.push(`/dashboard/conduite-changement/connexions?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">Inactifs depuis</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              current === o.value
                ? "bg-accent text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
