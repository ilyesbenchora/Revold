"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AgentAvatar } from "./agent-avatar";

/**
 * Avatar cliquable : au clic, ouvre une petite fenêtre décrivant le profil
 * d'expert du personnage et ce qu'il apporte.
 *
 * Contraintes techniques :
 *  - déclencheur = <span role="button"> (jamais un <button>), car ce composant
 *    est souvent placé DANS une carte-lien <a> → interdiction d'imbriquer des
 *    éléments interactifs (sinon crash d'hydratation).
 *  - la modale est rendue via un portal vers document.body pour ne pas être
 *    rognée par l'overflow / le transform de la carte parente.
 */
export function AgentProfileAvatar({
  name,
  emoji,
  image,
  role,
  pitch,
  size = 44,
  className = "",
  chatHref,
}: {
  name: string;
  emoji: string;
  image?: string | null;
  role: string;
  pitch: string;
  size?: number;
  className?: string;
  /** Lien vers le chat de l'agent — affiche un CTA « Discuter avec … » dans la fiche. */
  chatHref?: string;
}) {
  const [open, setOpen] = useState(false);

  // Bloque le scroll de fond quand la fiche est ouverte.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function openProfile(e: SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }
  function closeProfile(e: SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
  }

  // La fiche ne s'ouvre que sur clic (donc côté client) → document est défini.
  const modal =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={closeProfile}
          >
            <div
              className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeProfile}
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
                {chatHref && (
                  <Link
                    href={chatHref}
                    onClick={closeProfile}
                    className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
                  >
                    💬 Discuter avec {name} →
                  </Link>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        aria-label={`Profil de ${name}`}
        onClick={openProfile}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") openProfile(e);
        }}
        className={`inline-flex shrink-0 cursor-pointer rounded-full outline-none ring-offset-1 transition hover:ring-2 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      >
        <AgentAvatar name={name} emoji={emoji} image={image} size={size} />
      </span>
      {modal}
    </>
  );
}
