import type { ReactNode } from "react";
import { AdoptionTabs } from "@/components/adoption-tabs";
import { InsightLockedBlock } from "@/components/insight-locked-block";

export default function AdoptionLayout({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Adoption</h1>
        <p className="mt-1 text-sm text-slate-500">Mesure de l&apos;adoption du CRM : activités de vente, assets créés et connexions utilisateurs.</p>
      </header>

      <AdoptionTabs />

      {children}

      <InsightLockedBlock />
    </section>
  );
}
