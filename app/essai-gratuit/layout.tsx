import type { Metadata } from "next";

// Indexation resserrée : seules la home et le blog sont indexées — cette
// section est noindex (les liens y menant restent suivis).
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
