/**
 * Bilibili API layer
 *   - fetchArticleList: paginated article list for a user
 *   - fetchArticleContent: article plain-text content via API
 *
 * Reads BILIBILI_COOKIE from .env (or environment variable) for authenticated requests.
 */

import 'dotenv/config';
import axios from 'axios';

const LIST_API = 'https://api.bilibili.com/x/space/article';
const ARTICLE_API = 'https://api.bilibili.com/x/article/view';
const PAGE_SIZE = 20;

const COOKIE = process.env.BILIBILI_COOKIE?.trim() || '';

if (COOKIE) {
  console.log('[CONFIG] BILIBILI_COOKIE loaded ✔');
} else {
  console.log('[CONFIG] BILIBILI_COOKIE not set — requests are anonymous (higher risk of -352)');
}

// ── Build headers that closely match a real Chrome browser session ──────────
const browserHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  Referer: 'https://www.bilibili.com/',
  Origin: 'https://www.bilibili.com',
  'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-site',
  ...(COOKIE ? { Cookie: COOKIE } : {}),
};

const httpClient = axios.create({
  timeout: 15000,
  headers: browserHeaders,
});

/**
 * Fetch one page of articles for a user.
 * @param {string|number} mid  - Bilibili UID
 * @param {number} pn          - page number (1-based)
 * @returns {{ articles: Array<{id:number, title:string}>, total: number }}
 */
export async function fetchArticleList(mid, pn = 1) {
  const { data } = await httpClient.get(LIST_API, {
    params: { mid, pn, ps: PAGE_SIZE, sort: 'publish_time' },
  });

  if (data.code !== 0) {
    throw new Error(`API error ${data.code}: ${data.message}`);
  }

  const articles = (data.data?.articles ?? []).map((a) => ({
    id: a.id,
    title: a.title,
  }));

  const total = data.data?.count ?? 0;
  return { articles, total };
}

/**
 * Fetch article content via Bilibili API (returns plain text directly).
 * @param {number} cvid
 * @returns {string} plain text content
 */
export async function fetchArticleContent(cvid) {
  const { data } = await httpClient.get(ARTICLE_API, {
    params: { id: cvid },
  });

  if (data.code !== 0) {
    throw new Error(`API error ${data.code}: ${data.message}`);
  }

  // Prefer data.content (plain text); fallback to opus paragraphs
  const content = data.data?.content;
  if (content) return content;

  // Fallback: extract text from opus structured paragraphs
  const paragraphs = data.data?.opus?.content?.paragraphs;
  if (paragraphs && paragraphs.length > 0) {
    return paragraphs
      .filter((p) => p.para_type === 1 || p.para_type === 4)
      .map((p) =>
        (p.text?.nodes ?? [])
          .map((n) => n.word?.words ?? '')
          .join('')
      )
      .join('\n');
  }

  return '';
}
