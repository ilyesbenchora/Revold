import type { Metadata } from "next";
import { DM_Sans, Exo_2 } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Exo 2 = wordmark "Revold" : police géométrique futuriste aux traits très
// fins (poids 100/200), pour un rendu épuré et technologique.
const wordmark = Exo_2({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["100", "200", "300"],
});

export const metadata: Metadata = {
  title: {
    default: "Revold — Plateforme de Revenue Intelligence B2B",
    template: "%s — Revold",
  },
  description: "Revold connecte vos CRM, outils de facturation et plateformes de support pour piloter vos revenus avec des insights propulsés par l'IA.",
  metadataBase: new URL("https://revold.ai"),
  alternates: {
    // « ./ » = canonical RELATIF À CHAQUE PAGE (Next le résout par route).
    // ⚠ Ne jamais remettre "/" ici : toutes les pages pointaient leur
    // canonical vers la home → Google désindexait les sous-pages.
    canonical: "./",
    types: {
      "application/rss+xml": "/blog/rss.xml",
    },
  },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "Revold",
    url: "https://revold.ai",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Revold — Plateforme de Revenue Intelligence B2B" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Revold — Plateforme de Revenue Intelligence B2B",
    description: "Pilotez vos revenus avec des insights propulsés par l'IA. CRM, facturation et support connectés.",
    images: ["/og.png"],
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

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Revold",
  alternateName: "Revold — Revenue Intelligence",
  url: "https://revold.ai",
  logo: "https://revold.ai/icon.svg",
  description:
    "Revold connecte vos CRM, outils de facturation et plateformes de support pour piloter vos revenus avec des insights propulsés par l'IA.",
  foundingDate: "2025",
  areaServed: "FR",
  sameAs: [
    "https://www.linkedin.com/company/revold",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Revold",
  url: "https://revold.ai",
  inLanguage: "fr-FR",
  publisher: {
    "@type": "Organization",
    name: "Revold",
    logo: {
      "@type": "ImageObject",
      url: "https://revold.ai/icon.svg",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${wordmark.variable} h-full antialiased`}>
      <head>
        {/* Anti-flash : applique le thème AVANT le premier rendu (préférence
            Paramètres → Apparence, localStorage). DÉFAUT = sombre violet :
            sans préférence enregistrée (ou stockage indisponible), la
            plateforme démarre en violet-dark ; « light » explicite reste
            respecté. Le remap est scopé .dashboard-shell : les pages
            marketing ne sont pas affectées par l'attribut. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("revold:theme");if(t==="violet-dark"||t==="gold-dark"||t==="silver-dark")document.documentElement.dataset.theme=t;else if(t!=="light")document.documentElement.dataset.theme="violet-dark"}catch(e){document.documentElement.dataset.theme="violet-dark"}`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
