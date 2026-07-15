"use client";

import { useState } from "react";
import { AgentAvatar } from "./agent-avatar";

/**
 * Avatar cliquable : au clic, ouvre une petite fenêtre décrivant le profil
 * d'expert du personnage et ce qu'il apporte. Utilisable dans une carte-lien
 * (le clic sur l'avatar n'active pas la navigation du parent).
 */
export function AgentProfileAvatar({
  name,
  emoji,
  image,
  role,
  pitch,
  size = 44,
  className = "",
}: {
  name: string;
  emoji: string;
  image?: string | null;
  role: string;
  pitch: string;
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={`Profil de ${name}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={`shrink-0 rounded-full outline-none ring-offset-1 transition hover:ring-2 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      >
        <AgentAvatar name={name} emoji={emoji} image={image} size={size} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }}
        >
          <div
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }}
              aria-label="Fermer"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-500 shadow ring-1 ring-black/5 hover:bg-white hover:text-slate-800"
            >
              ✕
            </button>
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 px-5 pb-4 pt-6">
              <div className="flex items-center gap-3">
                <AgentAvatar name={name} emoji={emoji} image={image} size={64} className="ring-2 ring-white/70" />
                <div className="text-white">
                  <p className="text-lg font-semibold leading-tight">{name}</p>
                  <p className="text-xs font-medium text-white/80">✨ {role} · IA</p>
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ce que je t&apos;apporte</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{pitch}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
