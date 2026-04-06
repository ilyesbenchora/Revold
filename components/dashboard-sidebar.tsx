import Link from "next/link";

const sidebarLinks = [
  { href: "/dashboard", label: "Vue d'ensemble" },
  { href: "/dashboard/insights-ia", label: "Insights IA" },
  { href: "/dashboard/pipeline", label: "Pipeline" },
  { href: "/dashboard/deals-a-risque", label: "Deals à risque" },
  { href: "/dashboard/parametres", label: "Paramètres" },
];

export function DashboardSidebar() {
  return (
    <aside className="w-full border-r border-card-border bg-white px-4 py-6 md:w-64 md:px-5">
      <nav className="space-y-2">
        {sidebarLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
