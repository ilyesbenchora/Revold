import type { ReactNode } from "react";
import { InsightLockedBlock } from "@/components/insight-locked-block";

export default async function CoachingLayout({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Coaching IA</h1>
        <p className="mt-1 text-sm text-slate-500">
          Analyses, recommandations et coaching par catégorie. Naviguez entre les équipes via la barre latérale.
        </p>
      </header>

      {children}

      <InsightLockedBlock />
    </section>
  );
}
