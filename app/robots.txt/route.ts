export async function GET() {
  const body = `User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /api
Disallow: /login

Sitemap: https://revold.io/sitemap.xml
`;
  return new Response(body, {
    headers: { "Content-Type": "text/plain" },
  });
}
