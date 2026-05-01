/**
 * Génère les assets pour la candidature HubSpot App Marketplace + Stripe Partner.
 *
 * Sortie :
 *   public/marketplace/icon-128.png
 *   public/marketplace/icon-512.png
 *   public/marketplace/featured-1280x800.png
 *   public/marketplace/screenshot-1-dashboard.png        (1280x800)
 *   public/marketplace/screenshot-2-donnees.png
 *   public/marketplace/screenshot-3-performances.png
 *   public/marketplace/screenshot-4-coaching-ia.png
 *   public/marketplace/screenshot-5-onboarding.png
 *
 * Usage : node scripts/marketplace-assets.mjs
 */

import puppeteer from "puppeteer-core";
import { mkdir, readFile } from "node:fs/promises";

const BASE = "https://revold.io";
const OUT = "public/marketplace";
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const SCREENSHOT_PAGES = [
  { name: "screenshot-1-dashboard", path: "/dashboard", waitMs: 3500 },
  { name: "screenshot-2-donnees", path: "/dashboard/donnees", waitMs: 3500 },
  { name: "screenshot-3-performances", path: "/dashboard/performances/commerciale", waitMs: 3500 },
  { name: "screenshot-4-coaching-ia", path: "/dashboard/insights-ia", waitMs: 3500 },
  { name: "screenshot-5-paiement-facturation", path: "/dashboard/audit/paiement-facturation", waitMs: 4000 },
];

async function login(page) {
  console.log("→ Login");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.type('input[name="email"]', "Ilyes@lomed.fr");
  await page.type('input[name="password"]', "Lomed974!");
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
}

async function captureScreenshots(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await login(page);

  for (const { name, path, waitMs } of SCREENSHOT_PAGES) {
    try {
      console.log(`→ ${name}  (${path})`);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 30000 });
      await new Promise((r) => setTimeout(r, waitMs));
      await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
      console.log(`  ✓ ${OUT}/${name}.png (1280×800 @2x)`);
    } catch (err) {
      console.log(`  ✗ ${name} — ${err.message}`);
    }
  }
}

async function captureIcon(browser, size, filename) {
  const svg = await readFile("app/icon.svg", "utf8");
  // Adapte le viewBox pour ne pas déborder à la grande taille (la pastille est en x=38 pour viewBox 48 → ~80%)
  const html = `<!doctype html>
<html><head><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  body { width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; }
  svg { width: ${size}px; height: ${size}px; display: block; }
</style></head><body>${svg}</body></html>`;
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "load" });
  // Capture en PNG transparent
  await page.screenshot({
    path: `${OUT}/${filename}`,
    omitBackground: true,
    type: "png",
    clip: { x: 0, y: 0, width: size, height: size },
  });
  console.log(`  ✓ ${OUT}/${filename} (${size}×${size})`);
  await page.close();
}

async function captureFeaturedImage(browser) {
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@600;700&display=swap');
  html, body { margin: 0; padding: 0; }
  body {
    width: 1280px; height: 800px;
    background: linear-gradient(135deg, #fdf4ff 0%, #ffffff 50%, #eef2ff 100%);
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow: hidden;
    position: relative;
  }
  .bg-decor {
    position: absolute; inset: 0;
    background:
      radial-gradient(800px 400px at 90% 0%, rgba(217,70,239,0.18), transparent 60%),
      radial-gradient(600px 400px at 0% 100%, rgba(79,70,229,0.18), transparent 60%);
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px);
    background-size: 48px 48px;
    mask: linear-gradient(180deg, rgba(0,0,0,0.7), rgba(0,0,0,0.0));
  }
  .content {
    position: relative; z-index: 2;
    padding: 80px 96px; height: 100%;
    display: flex; flex-direction: column; justify-content: space-between;
  }
  .top { display: flex; align-items: center; gap: 16px; }
  .logo {
    width: 56px; height: 56px; border-radius: 14px;
    background: linear-gradient(135deg, #d946ef 0%, #a855f7 50%, #4f46e5 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-family: 'Space Grotesk'; font-weight: 800; font-size: 32px;
    position: relative;
    box-shadow: 0 8px 24px rgba(168,85,247,0.32);
  }
  .logo::after {
    content: '↗';
    position: absolute; top: -10px; right: -10px;
    width: 24px; height: 24px; border-radius: 50%;
    background: #fff; color: #c026d3;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800;
    box-shadow: 0 4px 12px rgba(192,38,211,0.25);
  }
  .wordmark {
    font-family: 'Space Grotesk'; font-weight: 700; font-size: 36px;
    background: linear-gradient(135deg, #d946ef, #4f46e5);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
    letter-spacing: -0.02em;
  }
  .badge {
    margin-left: auto;
    padding: 8px 16px; border-radius: 999px;
    background: rgba(217,70,239,0.1); color: #a21caf;
    font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
  }
  h1 {
    font-family: 'Space Grotesk'; font-weight: 700; font-size: 76px;
    line-height: 1.05; letter-spacing: -0.03em;
    color: #0f172a; margin: 0; max-width: 1000px;
  }
  h1 .accent {
    background: linear-gradient(135deg, #d946ef, #4f46e5);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .sub {
    margin-top: 28px; max-width: 760px;
    font-size: 22px; line-height: 1.5; color: #475569;
  }
  .footer {
    display: flex; align-items: center; gap: 24px;
    flex-wrap: wrap;
  }
  .pill {
    padding: 10px 18px; border-radius: 12px;
    background: #fff; border: 1px solid #e2e8f0;
    font-size: 14px; font-weight: 500; color: #334155;
    box-shadow: 0 4px 12px rgba(15,23,42,0.04);
  }
  .pill strong { color: #0f172a; font-weight: 700; }
  .pill .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; margin-right: 8px; vertical-align: middle; }
</style></head><body>
  <div class="bg-decor"></div>
  <div class="grid"></div>
  <div class="content">
    <div class="top">
      <div class="logo">R</div>
      <div class="wordmark">Revold</div>
      <div class="badge">HubSpot Marketplace</div>
    </div>

    <div>
      <h1>La couche d'intelligence <span class="accent">que votre HubSpot</span> ne peut pas générer.</h1>
      <p class="sub">Audit qualité CRM, forecast pondéré, deal coaching IA et cross-source HubSpot × Stripe. Connexion OAuth en 1 clic, hébergement UE, essai 14 jours.</p>
    </div>

    <div class="footer">
      <div class="pill"><span class="dot"></span><strong>175+ KPIs</strong> RevOps natifs</div>
      <div class="pill"><strong>13 connecteurs</strong> CRM × Billing × Support</div>
      <div class="pill"><strong>Hébergement EU</strong> Frankfurt — RGPD natif</div>
      <div class="pill"><strong>Time-to-value</strong> &lt; 5 min</div>
    </div>
  </div>
</body></html>`;
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1500)); // attendre les fonts
  await page.screenshot({
    path: `${OUT}/featured-1280x800.png`,
    type: "png",
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  });
  console.log(`  ✓ ${OUT}/featured-1280x800.png (1280×800)`);
  await page.close();
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1280,800"],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 },
  });

  console.log("\n=== Icons ===");
  await captureIcon(browser, 128, "icon-128.png");
  await captureIcon(browser, 512, "icon-512.png");

  console.log("\n=== Featured image ===");
  await captureFeaturedImage(browser);

  console.log("\n=== Screenshots dashboard ===");
  await captureScreenshots(browser);

  await browser.close();
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
