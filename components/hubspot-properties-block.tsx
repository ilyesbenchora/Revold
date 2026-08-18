"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Propriétés HubSpot cibles de l'enrichissement (SIREN, SIRET, TVA, statut
 * juridique, capital social, adresse du siège — selon les champs cochés dans
 * Paramètres → Enrichissement) : vérifie qu'elles existent dans le portail.
 * Affiché en haut de la page Enrichissement et dans les Paramètres.
 */

type PropertyRow = {
  field: string;
  name: string;
  label: string;
  status: "exists" | "missing" | "error";
  uniqueValue: boolean;
};

export function HubspotPropertiesBlock({ showSettingsLink = true }: { showSettingsLink?: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "disconnected" | "error">("loading");
  const [properties, setProperties] = useState<PropertyRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/enrichment/hubspot-properties");
        if (!res.ok) throw new Error();
        const d = (await res.json()) as { connected: boolean; properties: PropertyRow[] };
        if (cancelled) return;
        if (!d.connected) setState("disconnected");
        else {
          setProperties(d.properties);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "disconnected" || state === "error") return null;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Propriétés HubSpot de l&apos;enrichissement
        </p>
        {showSettingsLink && (
          <Link
            href="/dashboard/parametres/enrichissement"
            className="text-[11px] font-medium text-accent hover:underline"
          >
            Modifier les champs →
          </Link>
        )}
      </div>
      {state === "loading" ? (
        <p className="mt-2 text-xs text-slate-400">Vérification des propriétés dans ton portail HubSpot…</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {properties.map((p) => (
            <span
              key={p.field}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${
                p.status === "exists"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : p.status === "missing"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              title={`Propriété « ${p.name} » sur les fiches Company`}
            >
              {p.status === "exists" ? "✓" : p.status === "missing" ? "＋" : "?"} {p.label}
              <code className="rounded bg-white/60 px-1 text-[10px] text-slate-500">{p.name}</code>
              {p.status === "missing" && <span className="font-medium">créée à la prochaine synchro</span>}
            </span>
          ))}
        </div>
      )}
      <p className="mt-2 text-[10px] text-slate-400">
        Chaque champ enrichi est écrit dans la propriété HubSpot correspondante (champs vides uniquement). Une
        propriété manquante est créée automatiquement à l&apos;enregistrement des paramètres ou au lancement d&apos;un
        enrichissement.
      </p>
    </div>
  );
}
