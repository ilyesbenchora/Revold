import type { Metadata } from "next";

// Pages INDEXÉES : « revold hubspot », « revold stripe », « intégrations
// revold » sont des requêtes de marque et d'intégration à forte intention
// (chaque page porte son titre, sa description et son canonical).
export const metadata: Metadata = { robots: { index: true, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
