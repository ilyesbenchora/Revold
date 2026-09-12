#!/usr/bin/env node
/**
 * Positions Google Search Console des requêtes cibles (lib/seo/keywords.ts) —
 * sans dépendance : JWT RS256 signé avec node:crypto, échange contre un jeton
 * OAuth, puis Search Analytics API.
 *
 *   GSC_SERVICE_ACCOUNT_JSON='{...}' node scripts/seo-search-console.mjs [--site sc-domain:revold.ai] [--days 28] [--out audits/YYYY-MM-DD-seo-gsc.json]
 *
 * Prérequis (une fois, par Ilyes) : un compte de service Google Cloud (API
 * Search Console activée), ajouté comme utilisateur « Accès complet » sur la
 * propriété Search Console, et sa clé JSON dans la variable
 * GSC_SERVICE_ACCOUNT_JSON (Vercel + environnement de la routine).
 *
 * Sans la variable : le script s'arrête avec un message clair (code 2) et
 * l'agent se rabat sur des vérifications SERP.
 */

import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith("--") ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith("--") ? arr[i + 1] : "true"] : [])).filter((x) => x.length));
const SITE = args.site || process.env.GSC_SITE || "sc-domain:revold.ai";
const DAYS = Number(args.days || 28);
const today = new Date().toISOString().slice(0, 10);
const OUT = args.out || `audits/${today}-seo-gsc.json`;

const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
if (!raw) {
  console.error("GSC_SERVICE_ACCOUNT_JSON absent : pas de données Search Console (repli sur les vérifications SERP).");
  process.exit(2);
}
const sa = JSON.parse(raw);

const b64url = (s) => Buffer.from(s).toString("base64url");
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${header}.${claim}`).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claim}.${sig}` }),
  });
  if (!res.ok) throw new Error(`token: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function query(token, body) {
  const res = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE)}/searchAnalytics/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`searchAnalytics: HTTP ${res.status} ${await res.text()}`);
  return (await res.json()).rows ?? [];
}

function loadTargets() {
  const src = readFileSync("lib/seo/keywords.ts", "utf8");
  return [...src.matchAll(/keyword:\s*"([^"]+)",\s*group:\s*"([^"]+)",\s*url:\s*"([^"]+)",\s*priority:\s*(\d)/g)].map(([, keyword, group, url, priority]) => ({ keyword, group, url, priority: Number(priority) }));
}
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

async function main() {
  const token = await accessToken();
  const end = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10); // GSC a ~2 jours de retard
  const start = new Date(Date.now() - (DAYS + 2) * 86400000).toISOString().slice(0, 10);
  const prevEnd = new Date(Date.now() - (DAYS + 3) * 86400000).toISOString().slice(0, 10);
  const prevStart = new Date(Date.now() - (2 * DAYS + 3) * 86400000).toISOString().slice(0, 10);

  const [byQuery, byQueryPrev, byPage, byQueryPage] = await Promise.all([
    query(token, { startDate: start, endDate: end, dimensions: ["query"], rowLimit: 5000 }),
    query(token, { startDate: prevStart, endDate: prevEnd, dimensions: ["query"], rowLimit: 5000 }),
    query(token, { startDate: start, endDate: end, dimensions: ["page"], rowLimit: 1000 }),
    query(token, { startDate: start, endDate: end, dimensions: ["query", "page"], rowLimit: 5000 }),
  ]);

  const totals = (rows) => rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }), { clicks: 0, impressions: 0 });
  const cur = totals(byQuery), prev = totals(byQueryPrev);
  const qmap = new Map(byQuery.map((r) => [norm(r.keys[0]), r]));
  const qprev = new Map(byQueryPrev.map((r) => [norm(r.keys[0]), r]));
  const targets = loadTargets().map((t) => {
    const r = qmap.get(norm(t.keyword));
    const p = qprev.get(norm(t.keyword));
    const pages = byQueryPage.filter((x) => norm(x.keys[0]) === norm(t.keyword)).map((x) => ({ page: x.keys[1], position: +x.position.toFixed(1), clicks: x.clicks }));
    return {
      ...t,
      position: r ? +r.position.toFixed(1) : null,
      previousPosition: p ? +p.position.toFixed(1) : null,
      clicks: r?.clicks ?? 0,
      impressions: r?.impressions ?? 0,
      ctr: r ? +(r.ctr * 100).toFixed(1) : null,
      rankingPages: pages,
      top3: r ? r.position <= 3.5 : false,
    };
  });

  const report = {
    site: SITE, period: { start, end }, previous: { start: prevStart, end: prevEnd },
    totals: { clicks: cur.clicks, impressions: cur.impressions, previousClicks: prev.clicks, previousImpressions: prev.impressions },
    targets,
    topQueries: byQuery.sort((a, b) => b.clicks - a.clicks).slice(0, 50).map((r) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })),
    topPages: byPage.sort((a, b) => b.clicks - a.clicks).slice(0, 50).map((r) => ({ page: r.keys[0], clicks: r.clicks, impressions: r.impressions, position: +r.position.toFixed(1) })),
    // Requêtes à impressions sans page cible : opportunités de contenu.
    untargeted: byQuery.filter((r) => r.impressions >= 20 && !targets.some((t) => norm(t.keyword) === norm(r.keys[0]))).sort((a, b) => b.impressions - a.impressions).slice(0, 40).map((r) => ({ query: r.keys[0], impressions: r.impressions, clicks: r.clicks, position: +r.position.toFixed(1) })),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));

  const tracked = targets.filter((t) => t.position != null);
  const lines = [
    `## Search Console — ${DAYS} derniers jours (${start} → ${end})`,
    "",
    `- Clics : ${cur.clicks} (période précédente ${prev.clicks}) · Impressions : ${cur.impressions} (${prev.impressions})`,
    `- Requêtes cibles avec des impressions : ${tracked.length} / ${targets.length} · en top 3 : ${targets.filter((t) => t.top3).length} · position moyenne des cibles suivies : ${tracked.length ? (tracked.reduce((s, t) => s + t.position, 0) / tracked.length).toFixed(1) : "—"}`,
    "",
    "| Requête | Groupe | P | Position | Préc. | Clics | Impr. | Page qui ranke |",
    "|---|---|---|---|---|---|---|---|",
    ...targets.sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).map((t) => `| ${t.keyword} | ${t.group} | ${t.priority} | ${t.position ?? "—"} | ${t.previousPosition ?? "—"} | ${t.clicks} | ${t.impressions} | ${t.rankingPages[0]?.page?.replace("https://revold.ai", "") ?? "—"} |`),
    "",
  ];
  if (report.untargeted.length) lines.push("### Requêtes à impressions sans page cible (opportunités)", ...report.untargeted.slice(0, 15).map((u) => `- « ${u.query} » : ${u.impressions} impressions, position ${u.position}`), "");
  lines.push(`Détail complet : \`${OUT}\``);
  console.log(lines.join("\n"));
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
