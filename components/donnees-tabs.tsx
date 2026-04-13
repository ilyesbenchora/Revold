"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  contactsCount: number;
  companiesCount: number;
  dealsCount: number;
};

export function DonneesTabs({ contactsCount, companiesCount, dealsCount }: Props) {
  const pathname = usePathname();
  const tabs = [
    { href: "/dashboard/donnees", label: "Vue d'ensemble", count: null },
    { href: "/dashboard/donnees/contacts", label: "Contacts", count: contactsCount },
    { href: "/dashboard/donnees/entreprises", label: "Entreprises", count: companiesCount },
    { href: "/dashboard/donnees/transactions", label: "Transactions", count: dealsCount },
  ];

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {t.label}
              {t.count != null && (
                <span className={`ml-1.5 text-xs ${isActive ? "text-accent" : "text-slate-400"}`}>
                  {t.count.toLocaleString("fr-FR")}
                </span>
              )}
              {isActive && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
