import Link from "next/link";
import { listAgentsBySection, type AgentSection } from "@/lib/ai/agents/registry";

/**
 * Grille "vue d'ensemble" d'une section : une carte par agent expert,
 * redirigeant vers le chat agentique. Server component (pas d'état).
 */
export function AgentSectionGrid({
  section,
  title,
  subtitle,
  classicHref,
  classicLabel,
}: {
  section: AgentSection;
  title: string;
  subtitle: string;
  classicHref?: string;
  classicLabel?: string;
}) {
  const agents = listAgentsBySection(section);

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {classicHref && (
          <Link
            href={classicHref}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {classicLabel ?? "Version classique"}
          </Link>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {agents.map((a) => (
          <Link
            key={a.key}
            href={`/dashboard/agents/${a.key}`}
            className="group card overflow-hidden transition hover:shadow-lg hover:-translate-y-0.5"
          >
            <div className="h-1 bg-gradient-to-r from-amber-400 via-fuchsia-500 to-indigo-600" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white">
                  ✨
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-slate-900 transition group-hover:text-accent">
                    {a.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{a.tagline}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-300 transition group-hover:text-accent">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
