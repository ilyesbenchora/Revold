export const dynamic = "force-dynamic";

import { MonCompteTabs } from "@/components/mon-compte-tabs";
import { ThemeToggle } from "@/components/theme-toggle";

/** Mon compte → Apparence : thème clair / sombre (déplacé depuis Paramètres → Général). */
export default function MonCompteApparencePage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Mon compte</h1>
        <p className="mt-1 text-sm text-slate-500">Personnalisez l&apos;apparence de votre espace Revold.</p>
      </header>

      <MonCompteTabs />

      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">🎨 Apparence</h2>
        <ThemeToggle />
      </div>
    </section>
  );
}
