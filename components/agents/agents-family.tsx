"use client";

import Link from "next/link";
import { AgentProfileAvatar } from "./agent-profile-avatar";
import { getAgentPersona, personaImagePath } from "@/lib/ai/agents/coach-personas";

/**
 * « Photo de famille » des agents IA — un aperçu humain de l'équipe d'agents
 * Revold directement sur la home page. Avatars qui se chevauchent, façon photo
 * d'équipe, avec le prénom + rôle au survol.
 */

// Ordre choisi pour un beau mélange de rôles (Données / Coaching / Prévisions / Dashboard).
const FAMILY_KEYS = [
  "performance",
  "coaching-ventes",
  "prev-revenue",
  "paiement-facturation",
  "coaching-marketing",
  "reporting",
  "proprietes",
  "service-client",
  "prev-marketing",
  "automatisations",
  "coaching-data",
  "equipes",
];

export function AgentsFamily() {
  return (
    <div className="card overflow-hidden">
      <div className="relative bg-gradient-to-br from-fuchsia-50 via-white to-indigo-50 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-0.5 text-[11px] font-semibold text-fuchsia-700 ring-1 ring-fuchsia-100">
              <span>✨</span> Ton équipe d&apos;agents IA
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Une équipe d&apos;experts IA à ton service</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Chaque agent a sa spécialité — performance, coaching, prévisions, reporting. Ils analysent tes données et
              te proposent des actions concrètes.
            </p>
          </div>
          <Link
            href="/dashboard/insights-ia"
            className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 md:self-auto"
          >
            Rencontrer les agents →
          </Link>
        </div>

        {/* Rangée d'avatars qui se chevauchent — façon photo de famille */}
        <div className="mt-5 flex flex-wrap items-center gap-y-3 pl-3">
          {FAMILY_KEYS.map((key) => {
            const p = getAgentPersona(key);
            return (
              <div key={key} className="group relative -ml-3 transition hover:z-20">
                <div className="transition group-hover:-translate-y-1">
                  <AgentProfileAvatar
                    name={p.name}
                    emoji={p.emoji}
                    image={personaImagePath(key)}
                    role={p.role}
                    pitch={p.pitch}
                    size={56}
                    className="ring-2 ring-white"
                    chatHref={`/dashboard/agents/${key}`}
                  />
                </div>
                {/* Étiquette au survol (le clic ouvre la fiche de profil) */}
                <div className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 whitespace-nowrap rounded-lg border border-card-border bg-white px-2.5 py-1 text-center opacity-0 shadow-lg transition-opacity duration-150 group-hover:visible group-hover:opacity-100">
                  <span className="block text-[12px] font-semibold text-slate-900">{p.name}</span>
                  <span className="block text-[10px] text-slate-500">{p.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
