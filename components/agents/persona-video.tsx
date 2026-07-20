"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Vidéo de présentation d'un persona, dans sa fiche de profil.
 *
 * Convention de fichiers, calquée sur celle des portraits (/personas/<clé>.png) :
 *   public/personas/videos/<clé>.mp4   — l'avatar en mouvement qui parle
 *   public/personas/videos/<clé>.vtt   — sous-titres français (piste WebVTT)
 *
 * Tant que le mp4 n'existe pas, le composant ne rend RIEN : la fiche garde son
 * apparence actuelle. Aucun placeholder, aucun lecteur vide — un agent sans
 * vidéo ne doit pas donner l'impression d'un contenu cassé.
 */
export function PersonaVideo({ agentKey, name, poster }: { agentKey: string; name: string; poster?: string | null }) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const ref = useRef<HTMLVideoElement>(null);
  const src = `/personas/videos/${agentKey}.mp4`;

  // On teste l'existence du fichier avant de monter le <video> : un 404 sur une
  // balise vidéo affiche un lecteur cassé dans plusieurs navigateurs.
  useEffect(() => {
    let cancelled = false;
    fetch(src, { method: "HEAD" })
      .then((r) => { if (!cancelled) setAvailable(r.ok); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
  }, [src]);

  if (available !== true) return null;

  return (
    <div className="mb-4 overflow-hidden rounded-xl bg-slate-900 ring-1 ring-black/5">
      <video
        ref={ref}
        src={src}
        poster={poster ?? undefined}
        controls
        preload="none"
        playsInline
        className="block w-full"
        aria-label={`${name} présente son rôle et sa mission`}
      >
        {/* Sous-titres activés par défaut : la fiche s'ouvre souvent sans son. */}
        <track kind="subtitles" srcLang="fr" label="Français" src={`/personas/videos/${agentKey}.vtt`} default />
      </video>
    </div>
  );
}
