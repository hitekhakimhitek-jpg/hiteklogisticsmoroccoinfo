import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGoogleNewsRssUrl, parseGoogleNewsRss } from "./google-news.ts";

Deno.test("RSS fallback keeps publisher attribution and discovery source", () => {
  const xml = `<rss><channel><item>
    <title>Microsoft restores Outlook service - Reuters</title>
    <link>https://news.google.com/rss/articles/example</link>
    <pubDate>Tue, 17 Nov 2026 08:00:00 GMT</pubDate>
    <description>&lt;a href=&quot;https://news.google.com/rss/articles/example&quot;&gt;Microsoft restores Outlook service&lt;/a&gt; Reuters</description>
    <source url="https://www.reuters.com">Reuters</source>
  </item></channel></rss>`;
  const [article] = parseGoogleNewsRss(xml, "Global Breaking News", 5);
  assertEquals(article.source, "Reuters");
  assertEquals(article.requestedSource, "Global Breaking News");
  assertEquals(article.title, "Microsoft restores Outlook service");
  assertEquals(article.publishedDate, "2026-11-17");
  assertEquals(article.url, "https://news.google.com/rss/articles/example");
});

Deno.test("RSS fallback preserves a custom source domain filter", () => {
  const url = new URL(buildGoogleNewsRssUrl("site:news.example.com freight OR port", true));
  assertEquals(url.searchParams.get("q"), "site:news.example.com freight OR port when:7d");
});

Deno.test("normal RSS search removes Firecrawl site syntax for broad discovery", () => {
  const url = new URL(buildGoogleNewsRssUrl("port update site:example.com"));
  assertEquals(url.searchParams.get("q"), "port update when:7d");
});