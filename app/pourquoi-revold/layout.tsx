import type { Metadata } from "next";

// Page de MARQUE indexée : « pourquoi revold » renforce l'entité Revold
// (différenciateurs, positionnement) pour les moteurs classiques et génératifs.
export const metadata: Metadata = { robots: { index: true, follow: true }, alternates: { canonical: "/pourquoi-revold" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
