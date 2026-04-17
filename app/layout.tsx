import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Revold — Plateforme de Revenue Intelligence B2B",
    template: "%s — Revold",
  },
  description: "Revold connecte vos CRM, outils de facturation et plateformes de support pour piloter vos revenus avec des insights propulsés par l'IA.",
  metadataBase: new URL("https://revold.io"),
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": "/blog/rss.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Revold",
    url: "https://revold.io",
  },
  twitter: {
    card: "summary_large_image",
    title: "Revold — Plateforme de Revenue Intelligence B2B",
    description: "Pilotez vos revenus avec des insights propulsés par l'IA. CRM, facturation et support connectés.",
  },
  keywords: [
    "revenue intelligence",
    "RevOps",
    "plateforme RevOps",
    "CRM intelligence",
    "HubSpot analytics",
    "Salesforce analytics",
    "insights IA",
    "pilotage revenue",
    "B2B France",
    "Revold",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
