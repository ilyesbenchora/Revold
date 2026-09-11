/**
 * robots.txt — le site marketing est ouvert à tous les robots, y compris les
 * robots des moteurs GÉNÉRATIFS (OpenAI, Anthropic, Perplexity, Google AI,
 * Bing/Copilot, Apple, Common Crawl) : être cité par ChatGPT, Claude ou les
 * AI Overviews suppose d'être crawlable par eux. Seules les zones privées
 * (dashboard, API, login, partages) sont exclues.
 */
const PRIVATE = ["/dashboard", "/api", "/login", "/auth", "/partage"];

const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "Applebot",
  "Applebot-Extended",
  "CCBot",
  "DuckAssistBot",
  "MistralAI-User",
  "meta-externalagent",
  "Amazonbot",
  "YouBot",
];

export async function GET() {
  const group = (agent: string) => [`User-agent: ${agent}`, "Allow: /", ...PRIVATE.map((p) => `Disallow: ${p}`), ""].join("\n");
  const body = [
    group("*"),
    ...AI_BOTS.map(group),
    "Sitemap: https://revold.ai/sitemap.xml",
    "",
    "# Carte du site pour les assistants IA : https://revold.ai/llms.txt",
    "",
  ].join("\n");
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "s-maxage=86400, stale-while-revalidate" },
  });
}
