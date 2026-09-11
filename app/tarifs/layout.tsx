import type { Metadata } from "next";

// Page de MARQUE indexée : « revold tarifs » / « revold prix » sont des
// requêtes de navigation — la page porte les prix publics et sa FAQ.
export const metadata: Metadata = { robots: { index: true, follow: true }, alternates: { canonical: "/tarifs" } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
