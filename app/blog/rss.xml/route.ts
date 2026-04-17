import { articles } from "../data";

export async function GET() {
  const baseUrl = "https://revold.io";
  const sorted = [...articles].sort((a, b) => b.date.localeCompare(a.date));

  const items = sorted
    .map(
      (a) => `    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>${baseUrl}/blog/${a.slug}</link>
      <guid isPermaLink="true">${baseUrl}/blog/${a.slug}</guid>
      <description><![CDATA[${a.description}]]></description>
      <category>${a.category}</category>
      <author>${a.author}</author>
      <pubDate>${new Date(a.date).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Blog Revold</title>
    <description>Insights, guides et analyses pour les équipes revenue B2B françaises.</description>
    <link>${baseUrl}/blog</link>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/blog/rss.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate",
    },
  });
}
