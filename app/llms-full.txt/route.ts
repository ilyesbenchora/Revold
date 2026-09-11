import { BRAND, BRAND_DEFINITION, CAPABILITIES, PRICING, fmtPrice, SITE_URL } from "@/lib/seo/site";
import { KEYWORD_PAGES } from "@/lib/seo/keyword-pages";
import { COMPETITORS } from "@/lib/seo/competitors";

/**
 * /llms-full.txt — contenu complet des guides et comparatifs en texte brut,
 * pour que les moteurs génératifs disposent des définitions, tableaux et FAQ
 * sans avoir à rendre le HTML.
 */
export async function GET() {
  const out: string[] = [
    `# ${BRAND.name} — contenu complet`,
    "",
    `> ${BRAND_DEFINITION}`,
    "",
    "## Fiche d'identité",
    "",
    `- Site : ${SITE_URL}`,
    `- Éditeur : ${BRAND.editor}`,
    `- Fondation : ${BRAND.foundingDate}, par ${BRAND.founder.name} (${BRAND.founder.role})`,
    `- Marché : entreprises B2B françaises de 10 à 500 salariés`,
    `- Langue : français`,
    `- Connecteurs natifs : ${BRAND.integrations.join(", ")}`,
    `- Notifications : ${BRAND.notifications.join(", ")}`,
    `- Tarifs : ${PRICING.map((p) => `${p.name} ${"from" in p && p.from ? "à partir de " : ""}${fmtPrice(p.monthly)} HT/mois (${fmtPrice(p.yearly)} HT/an, ${p.connectors})`).join(" ; ")} ; essai gratuit ${BRAND.trialDays} jours sans carte bancaire`,
    `- Hébergement : ${BRAND.hosting}`,
    `- Contacts : ${BRAND.contact.support} (support), ${BRAND.contact.security} (sécurité), ${BRAND.contact.dpo} (données personnelles)`,
    "",
    "## Capacités",
    "",
    ...CAPABILITIES.map((c) => `- ${c}`),
    "",
  ];

  for (const p of KEYWORD_PAGES) {
    out.push(`# ${p.title}`, "", `URL : ${SITE_URL}/${p.slug}`, "", `**Réponse courte.** ${p.answer}`, "", p.intro, "");
    for (const s of p.sections) {
      out.push(`## ${s.h2}`, "", ...s.paragraphs.map((x) => `${x}\n`));
      if (s.bullets) out.push(...s.bullets.map((b) => `- ${b}`), "");
    }
    out.push("## Pourquoi Revold", "", ...p.whyRevold.map((w) => `- **${w.title}** — ${w.desc}`), "", "## FAQ", "");
    for (const f of p.faq) out.push(`**${f.q}**`, "", f.a, "");
  }

  for (const c of COMPETITORS) {
    out.push(`# ${c.title}`, "", `URL : ${SITE_URL}/alternative/${c.slug}`, "", `**Réponse courte.** ${c.answer}`, "", `## Qu'est-ce que ${c.name} ?`, "", c.summary, "", "## Comparatif", "");
    out.push(`| Critère | ${c.name} | Revold |`, "|---|---|---|", ...c.table.map((r) => `| ${r.criterion} | ${r.them} | ${r.revold} |`), "");
    out.push(`## Quand choisir ${c.name}`, "", ...c.chooseThem.map((b) => `- ${b}`), "", "## Quand choisir Revold", "", ...c.chooseRevold.map((b) => `- ${b}`), "", "## FAQ", "");
    for (const f of c.faq) out.push(`**${f.q}**`, "", f.a, "");
  }

  return new Response(out.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "s-maxage=86400, stale-while-revalidate" },
  });
}
