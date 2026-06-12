import fs from "node:fs";

const BLOCKED_DOMAINS = [
  "wikipedia.org",
  "wikimedia.org",
  "namu.wiki",
  "fandom.com",
  "x.com",
  "twitter.com",
  "threads.net",
  "instagram.com",
  "facebook.com"
];

const ALLOWED_DOMAINS = [
  "stoo.com",
  "sportsseoul.com",
  "mk.co.kr",
  "osen.co.kr",
  "xportsnews.com",
  "mydaily.co.kr",
  "starnewskorea.com",
  "sports.khan.co.kr",
  "news.nate.com",
  "newsen.com",
  "news1.kr",
  "yna.co.kr",
  "isplus.com",
  "sports.chosun.com",
  "topstarnews.net",
  "bntnews.co.kr",
  "nownews.com",
  "setn.com",
  "ettoday.net",
  "udn.com",
  "cna.com.tw",
  "taisounds.com"
];

const QUERIES = [
  {
    desk: "Korean",
    query: "치어리더 OR 한국 치어리더 OR 야구 치어리더",
    locale: "hl=ko&gl=KR&ceid=KR:ko"
  },
  {
    desk: "Korean",
    query: "이주은 OR 안지현 OR 하지원 OR 김한슬 OR 박담비 OR 박성은 OR 신세희 치어리더",
    locale: "hl=ko&gl=KR&ceid=KR:ko"
  },
  {
    desk: "Korean",
    query: "KBO 치어리더 OR KBL 치어리더 OR 광화문 치어리더",
    locale: "hl=ko&gl=KR&ceid=KR:ko"
  },
  {
    desk: "Taiwan",
    query: "韓國啦啦隊 OR 韓籍啦啦隊 OR 富邦 Angels 韓國 OR Rakuten Girls 韓國",
    locale: "hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
  },
  {
    desk: "Taiwan",
    query: "李珠珢 OR 南珉貞 OR 朴星垠 OR 李雅英 OR 張珞娜 OR 高佳彬 OR 金世星",
    locale: "hl=zh-TW&gl=TW&ceid=TW:zh-Hant"
  }
];

const decode = (value = "") => value
  .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#39;/g, "'");

const stripTags = (value = "") => decode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const extractItems = (xml) => {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = match[1];
    const title = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "").trim();
    const link = decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "").trim();
    const pubDate = decode(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "").trim();
    const source = stripTags(item.match(/<source[\s\S]*?>([\s\S]*?)<\/source>/)?.[1] || "");
    const description = stripTags(item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || "");
    if (title && link) {
      items.push({ title, link, pubDate, source, description });
    }
  }
  return items;
};

const normalizedUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const nested = url.searchParams.get("url");
    return nested || rawUrl;
  } catch {
    return rawUrl;
  }
};

const domainOf = (rawUrl) => {
  try {
    return new URL(normalizedUrl(rawUrl)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isAllowed = (item) => {
  const domain = domainOf(item.link);
  if (!domain || BLOCKED_DOMAINS.some((blocked) => domain.endsWith(blocked))) {
    return false;
  }
  return ALLOWED_DOMAINS.some((allowed) => domain.endsWith(allowed));
};

const rssUrl = ({ query, locale }) => {
  const encoded = encodeURIComponent(`${query} when:2d`);
  return `https://news.google.com/rss/search?q=${encoded}&${locale}`;
};

const seen = new Set();
const candidates = [];
const scanErrors = [];

for (const config of QUERIES) {
  const url = rssUrl(config);
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "HakboniNewsroomCheck/1.0"
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    for (const item of extractItems(xml)) {
      const link = normalizedUrl(item.link);
      const domain = domainOf(link);
      const key = `${item.title} ${domain}`;
      if (seen.has(key) || !isAllowed({ ...item, link })) {
        continue;
      }
      seen.add(key);
      candidates.push({
        desk: config.desk,
        title: item.title,
        source: item.source || domain,
        domain,
        pubDate: item.pubDate,
        link,
        description: item.description
      });
    }
  } catch (error) {
    scanErrors.push({
      desk: config.desk,
      query: config.query,
      link: url,
      error: error.message
    });
  }
}

const ordered = candidates.sort((a, b) => {
  const deskRank = (desk) => desk === "Korean" ? 0 : 1;
  return deskRank(a.desk) - deskRank(b.desk);
});

const report = [
  "# Hakboni Newsroom Cloud Check",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "This automated cloud scan is a candidate list only. Nash must verify the source page, date, title, summary, image metadata, and fit before any site update.",
  "",
  ordered.length ? "## Candidates" : "## No candidates found",
  "",
  ...ordered.flatMap((item, index) => [
    `### ${index + 1}. ${item.title}`,
    "",
    `- Desk: ${item.desk}`,
    `- Source: ${item.source}`,
    `- Domain: ${item.domain}`,
    `- Published: ${item.pubDate || "Unknown"}`,
    `- Link: ${item.link}`,
    `- Snippet: ${item.description || "No snippet available"}`,
    ""
  ]),
  scanErrors.length ? "## Scan Errors" : "",
  "",
  ...scanErrors.flatMap((item) => [
    `- ${item.desk}: ${item.query}`,
    `  - Link: ${item.link}`,
    `  - Error: ${item.error}`,
    ""
  ]),
  "## Editorial Rules",
  "",
  "- Korean-source stories should be prioritized at roughly 5:1 over Taiwan-source stories.",
  "- Do not publish wiki, social-only, fan-page, or unsourced claims.",
  "- Use social media only as a lead, never as the publishable source.",
  "- Every candidate needs image/crop review before going live."
].join("\n");

fs.writeFileSync("newsroom-report.md", report);
fs.writeFileSync("newsroom-candidates.json", JSON.stringify(ordered, null, 2));
console.log(report);
