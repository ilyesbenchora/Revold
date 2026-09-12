#!/usr/bin/env node
/**
 * Audit technique SEO / GEO du site public — sans dépendance, exécutable en
 * local ou dans une routine cloud :
 *
 *   node scripts/seo-audit.mjs [--base https://revold.ai] [--out audits/YYYY-MM-DD-seo-audit.json] [--max 150]
 *
 * Pour chaque URL du sitemap : statut HTTP, temps de réponse, <title> (longueur),
 * meta description (longueur), canonical, robots, nombre de H1, types JSON-LD,
 * nombre de mots, liens internes, et — d'après lib/seo/keywords.ts — si les
 * requêtes cibles de la page apparaissent dans le title / H1 / premier
 * paragraphe. Vérifie aussi robots.txt, llms.txt, le flux RSS et la clé IndexNow.
 *
 * Sortie : JSON complet (--out) + résumé Markdown sur stdout, prêt à coller
 * dans le rapport hebdomadaire de l'agent SEO (.claude/agents/seo-geo-expert.md).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"] : [])).filter((x) => x.length));
const BASE = (args.base || "https://revold.ai").replace(/\/$/, "");
const MAX = Number(args.max || 150);
const today = new Date().toISOString().slice(0, 10);
const OUT = args.out || `audits/${today}-seo-audit.json`;

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Cibles par URL depuis lib/seo/keywords.ts (parsé sans TypeScript). */
function loadTargets() {
  try {
    const src = readFileSync("lib/seo/keywords.ts", "utf8");
    const out = new Map();
    for (const m of src.matchAll(/keyword:\s*"([^"]+)",\s*group:\s*"([^"]+)",\s*url:\s*"([^"]+)",\s*priority:\s*(\d)/g)) {
      const [, keyword, group, url, priority] = m;
      out.set(url, [...(out.get(url) ?? []), { keyword, group, priority: Number(priority) }]);
    }
    return out;
  } catch {
    return new Map();
  }
}

async function fetchText(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "RevoldSeoAudit/1.0 (+https://revold.ai)" }, redirect: "manual" });
    const text = await res.text();
    return { status: res.status, ms: Date.now() - started, text, headers: res.headers, location: res.headers.get("location") };
  } catch (e) {
    return { status: 0, ms: Date.now() - started, text: "", headers: new Headers(), error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

const pick = (html, re) => { const m = html.match(re); return m ? m[1].replace(/\s+/g, " ").trim() : null; };
const decode = (s) => (s ?? "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");

function analyze(url, html, targets) {
  const title = decode(pick(html, /<title[^>]*>([^<]*)<\/title>/i));
  const description = decode(pick(html, /<meta\s+name="description"\s+content="([^"]*)"/i) ?? pick(html, /<meta\s+content="([^"]*)"\s+name="description"/i));
  const canonical = pick(html, /<link\s+rel="canonical"\s+href="([^"]*)"/i);
  const robots = pick(html, /<meta\s+name="robots"\s+content="([^"]*)"/i);
  const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()));
  const ldTypes = [...html.matchAll(/"@type":"([A-Za-z]+)"/g)].map((m) => m[1]);
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const words = body.split(/\s+/).filter((w) => w.length > 1).length;
  const internalLinks = new Set([...html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1])).size;
  const firstPara = decode(pick(html, /<p[^>]*>([\s\S]{40,600}?)<\/p>/i)?.replace(/<[^>]+>/g, "") ?? "");
  const kw = (targets.get(new URL(url).pathname) ?? []).map((t) => {
    const k = norm(t.keyword);
    return {
      keyword: t.keyword,
      priority: t.priority,
      inTitle: norm(title ?? "").includes(k),
      inH1: h1s.some((h) => norm(h).includes(k)),
      inIntro: norm(firstPara).includes(k),
    };
  });
  const issues = [];
  if (!title) issues.push("title absent");
  else if (title.length > 65) issues.push(`title long (${title.length})`);
  else if (title.length < 25) issues.push(`title court (${title.length})`);
  if (!description) issues.push("description absente");
  else if (description.length > 165) issues.push(`description longue (${description.length})`);
  else if (description.length < 70) issues.push(`description courte (${description.length})`);
  if (!canonical) issues.push("canonical absent");
  else if (canonical.replace(/\/$/, "") !== url.replace(/\/$/, "")) issues.push(`canonical ≠ url (${canonical})`);
  if (robots && /noindex/i.test(robots)) issues.push("noindex");
  if (h1s.length !== 1) issues.push(`${h1s.length} H1`);
  if (words < 300) issues.push(`contenu court (${words} mots)`);
  if (internalLinks < 8) issues.push(`peu de liens internes (${internalLinks})`);
  for (const t of kw) if (t.priority === 1 && !t.inTitle && !t.inH1) issues.push(`requête P1 « ${t.keyword} » ni dans le title ni dans le H1`);
  return { title, titleLength: title?.length ?? 0, description, descriptionLength: description?.length ?? 0, canonical, robots, h1s, ldTypes: [...new Set(ldTypes)], words, internalLinks, keywords: kw, issues };
}

async function main() {
  const targets = loadTargets();
  const report = { base: BASE, date: today, pages: [], files: {}, summary: {} };

  // Fichiers techniques.
  for (const f of ["/robots.txt", "/llms.txt", "/llms-full.txt", "/blog/rss.xml", "/sitemap.xml"]) {
    const r = await fetchText(BASE + f);
    report.files[f] = { status: r.status, ms: r.ms, bytes: r.text.length, contentType: r.headers.get("content-type") };
    if (f === "/robots.txt") report.files[f].aiBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "Bingbot"].filter((b) => r.text.includes(b));
    if (f === "/blog/rss.xml") { report.files[f].items = (r.text.match(/<item>/g) ?? []).length; report.files[f].hub = /rel="hub"/.test(r.text); report.files[f].latest = pick(r.text, /<pubDate>([^<]*)<\/pubDate>/); }
    if (f === "/sitemap.xml") report.files[f].urls = (r.text.match(/<loc>/g) ?? []).length;
  }
  const sm = await fetchText(BASE + "/sitemap.xml");
  const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).slice(0, MAX);

  // Pages, 5 en parallèle.
  let i = 0;
  const workers = Array.from({ length: 5 }, async () => {
    while (i < urls.length) {
      const url = urls[i++];
      const r = await fetchText(url);
      const page = { url, status: r.status, ms: r.ms, redirect: r.location ?? null };
      if (r.status === 200) Object.assign(page, analyze(url, r.text, targets));
      else page.issues = [r.status === 0 ? `erreur réseau (${r.error})` : `HTTP ${r.status}`];
      report.pages.push(page);
    }
  });
  await Promise.all(workers);
  report.pages.sort((a, b) => a.url.localeCompare(b.url));

  const ok = report.pages.filter((p) => p.status === 200);
  report.summary = {
    urls: report.pages.length,
    http200: ok.length,
    errors: report.pages.filter((p) => p.status !== 200).map((p) => `${p.url} → ${p.status}`),
    pagesWithIssues: report.pages.filter((p) => (p.issues ?? []).length > 0).length,
    avgMs: Math.round(ok.reduce((s, p) => s + p.ms, 0) / Math.max(1, ok.length)),
    slow: ok.filter((p) => p.ms > 2500).map((p) => `${p.url} (${p.ms} ms)`),
    missingFaq: ok.filter((p) => /^\/(?!blog\/|produits|solutions|equipes|integrations|docs|tarifs|pourquoi|$)/.test(new URL(p.url).pathname) && !(p.ldTypes ?? []).includes("FAQPage")).map((p) => new URL(p.url).pathname),
    p1KeywordGaps: ok.flatMap((p) => (p.keywords ?? []).filter((k) => k.priority === 1 && !k.inTitle && !k.inH1).map((k) => `${new URL(p.url).pathname} ← « ${k.keyword} »`)),
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));

  // Résumé Markdown.
  const s = report.summary;
  const lines = [
    `## Audit technique — ${today}`,
    "",
    `- URLs du sitemap auditées : ${s.urls} · en 200 : ${s.http200} · temps moyen : ${s.avgMs} ms`,
    `- Pages avec au moins un point à corriger : ${s.pagesWithIssues}`,
    `- robots.txt : robots IA déclarés → ${(report.files["/robots.txt"].aiBots ?? []).join(", ") || "aucun"}`,
    `- llms.txt : HTTP ${report.files["/llms.txt"].status} · RSS : ${report.files["/blog/rss.xml"].items} items, hub ${report.files["/blog/rss.xml"].hub ? "déclaré" : "ABSENT"}, dernier ${report.files["/blog/rss.xml"].latest ?? "?"}`,
    "",
  ];
  if (s.errors.length) lines.push("### Erreurs HTTP", ...s.errors.map((e) => `- ${e}`), "");
  if (s.slow.length) lines.push("### Pages lentes (> 2,5 s)", ...s.slow.map((e) => `- ${e}`), "");
  if (s.p1KeywordGaps.length) lines.push("### Requêtes prioritaires absentes du title et du H1", ...s.p1KeywordGaps.map((e) => `- ${e}`), "");
  const issues = report.pages.filter((p) => (p.issues ?? []).length > 0);
  if (issues.length) {
    lines.push("### Points par page", "", "| Page | Points |", "|---|---|");
    for (const p of issues) lines.push(`| ${new URL(p.url).pathname} | ${p.issues.join(" · ")} |`);
    lines.push("");
  }
  lines.push(`Détail complet : \`${OUT}\``);
  console.log(lines.join("\n"));
}

main().catch((e) => { console.error(e); process.exit(1); });
