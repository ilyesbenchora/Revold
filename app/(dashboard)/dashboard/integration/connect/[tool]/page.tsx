export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { getConnectableTool, getCategoryLabel } from "@/lib/integrations/connect-catalog";
import { getOrgId } from "@/lib/supabase/cached";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BrandLogo } from "@/components/brand-logo";
import { connectToolAction, disconnectToolAction } from "./actions";

const ERROR_MESSAGES: Record<string, string> = {
  no_org: "Aucune organisation associée à votre compte.",
  save_failed: "Erreur lors de l'enregistrement des identifiants. Réessayez.",
  unknown_tool: "Outil inconnu.",
};

export default async function ConnectToolPage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tool: toolKey } = await params;
  const sp = await searchParams;
  const tool = getConnectableTool(toolKey);
  if (!tool) notFound();

  // Detect existing connection
  let alreadyConnected = false;
  const orgId = await getOrgId();
  if (orgId) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("integrations")
      .select("id")
      .eq("organization_id", orgId)
      .eq("provider", toolKey)
      .eq("is_active", true)
      .maybeSingle();
    alreadyConnected = !!data;
  }

  const errorKey = typeof sp.error === "string" ? sp.error : null;
  const errorMessage = errorKey
    ? ERROR_MESSAGES[errorKey] ?? (errorKey.startsWith("missing_") ? `Champ requis manquant : ${errorKey.replace("missing_", "")}` : "Une erreur est survenue.")
    : null;

  // Bind the tool key to the server action
  const submitAction = connectToolAction.bind(null, toolKey);
  const disconnectAction = disconnectToolAction.bind(null, toolKey);

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard/integration"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        Retour aux intégrations
      </Link>

      <div className="card p-6">
        <div className="flex items-start gap-4">
          <BrandLogo domain={tool.domain} alt={tool.label} fallback={tool.icon} size={56} />
          <div className="flex-1">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {getCategoryLabel(tool.category)}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">
              Connecter {tool.label}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{tool.description}</p>
          </div>
          {alreadyConnected && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              ✓ Connecté
            </span>
          )}
        </div>

        {/* Help block */}
        <div className="mt-6 rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
          <p className="text-sm font-semibold text-indigo-900">Comment obtenir vos identifiants ?</p>
          <p className="mt-1 text-sm text-indigo-800">{tool.helpText}</p>
          <a
            href={tool.helpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline"
          >
            Documentation officielle {tool.label}
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form action={submitAction} className="mt-6 space-y-4">
          {tool.fields.map((field) => (
            <div key={field.key}>
              <label htmlFor={field.key} className="block text-sm font-medium text-slate-700">
                {field.label}
              </label>
              <input
                id={field.key}
                name={field.key}
                type={field.type}
                placeholder={field.placeholder}
                required
                autoComplete="off"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
              {field.helper && (
                <p className="mt-1 text-xs text-slate-500">{field.helper}</p>
              )}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-slate-400">
              🔒 Vos identifiants sont stockés chiffrés dans Revold (Supabase RLS).
            </p>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
            >
              {alreadyConnected ? "Mettre à jour" : "Connecter à Revold"}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </form>

        {alreadyConnected && (
          <form action={disconnectAction} className="mt-6 border-t border-slate-200 pt-4">
            <button
              type="submit"
              className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline"
            >
              Déconnecter {tool.label}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
