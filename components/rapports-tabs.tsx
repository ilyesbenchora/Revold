"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  myCount?: number;
  singleCount?: number;
  multiCount?: number;
};

export function RapportsTabs({ myCount, singleCount, multiCount }: Props) {
  const pathname = usePathname();
  const tabs = [
    {
      href: "/dashboard/rapports/mes-rapports",
      label:
        myCount != null ? `Mes rapports (${myCount})` : "Mes rapports",
    },
    {
      href: "/dashboard/rapports/integration-unique",
      label:
        singleCount != null
          ? `Intégration unique (${singleCount})`
          : "Intégration unique",
    },
    {
      href: "/dashboard/rapports/integrations-multiples",
      label:
        multiCount != null
          ? `Intégrations multiples (${multiCount})`
          : "Intégrations multiples",
    },
  ];

  return (
    <div className="border-b border-card-border">
      <div className="flex gap-1">
        {tabs.map((t) => {
          const isActive = pathname === t.href || pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`relative px-4 py-2 text-sm font-medium transition ${
                isActive ? "text-accent" : "text-slate-500 hover:text-slate-900"
              }`}
            >
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
