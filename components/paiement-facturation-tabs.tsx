"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const tabs: Array<{ href: string; label: string; highlight?: boolean }> = [
  { href: "/dashboard/audit/paiement-facturation", label: "Vue d'ensemble" },
  { href: "/dashboard/audit/paiement-facturation/facturation", label: "Facturation" },
  { href: "/dashboard/audit/paiement-facturation/paiement", label: "Paiement" },
  { href: "/dashboard/audit/paiement-facturation/comptabilite", label: "Comptabilité" },
  { href: "/dashboard/audit/paiement-facturation/previsionnel", label: "Prévisionnel" },
  { href: "/dashboard/audit/paiement-facturation/clients-fournisseurs", label: "Clients & Fournisseurs" },
  { href: "/dashboard/audit/paiement-facturation/fiscal", label: "Fiscal & social" },
];

export function PaiementFacturationTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Les sources sélectionnées (switcher mono ou multi) sont conservées
  // en passant d'onglet en onglet.
  const source = searchParams.get("source");
  const sources = searchParams.get("sources");
  const parts = [
    sources ? `sources=${encodeURIComponent(sources)}` : null,
    source ? `source=${encodeURIComponent(source)}` : null,
  ].filter(Boolean);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={`${t.href}${qs}`}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              } ${t.highlight ? "flex items-center gap-1.5" : ""}`}
            >
              {t.highlight && <span aria-hidden>✨</span>}
              {t.label}
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
