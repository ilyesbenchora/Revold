import puppeteer from "puppeteer-core";

const BASE = "https://revold.io";
const SCREENSHOTS_DIR = "public/screenshots";

// Pages to screenshot (these are public landing/solution pages, no auth needed)
// But dashboard pages need auth — we'll use the login flow
const PAGES = [
  { name: "dashboard-overview", path: "/dashboard", description: "Vue d'ensemble" },
  { name: "dashboard-pipeline", path: "/dashboard/pipeline", description: "Pipeline" },
  { name: "dashboard-performances", path: "/dashboard/performances", description: "Performances" },
  { name: "dashboard-insights", path: "/dashboard/insights-ia", description: "Insights IA" },
  { name: "dashboard-donnees", path: "/dashboard/donnees", description: "Données" },
  { name: "dashboard-alertes", path: "/dashboard/alertes", description: "Alertes" },
];

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1440,900"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();

  // Login first
  console.log("Logging in...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });

  // Fill login form (creds via env REVOLD_SCREENSHOT_EMAIL/PASSWORD dans .env.local)
  const email = process.env.REVOLD_SCREENSHOT_EMAIL;
  const password = process.env.REVOLD_SCREENSHOT_PASSWORD;
  if (!email || !password) {
    throw new Error("REVOLD_SCREENSHOT_EMAIL / REVOLD_SCREENSHOT_PASSWORD manquants — voir .env.local");
  }
  await page.waitForSelector('input[name="email"]', { timeout: 10000 });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));

  console.log("Current URL after login:", page.url());

  // Take screenshots
  for (const { name, path } of PAGES) {
    try {
      console.log(`Capturing ${name}...`);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2", timeout: 20000 });
      await new Promise((r) => setTimeout(r, 2000)); // let animations settle
      await page.screenshot({
        path: `${SCREENSHOTS_DIR}/${name}.png`,
        fullPage: false, // just viewport
      });
      console.log(`  ✓ ${name}.png saved`);
    } catch (err) {
      console.log(`  ✗ ${name} failed: ${err.message}`);
    }
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
