/**
 * B站 API 请求层
 *   - fetchArticleList: 分页获取用户文章列表
 *   - fetchArticleContent: 通过 API 获取文章正文
 *
 * 从 .env 中读取 BILIBILI_COOKIE 用于携带登录态请求。
 */

import 'dotenv/config';
import axios from 'axios';
import type { ArticleListResult } from './types.js';

const LIST_API = 'https://api.bilibili.com/x/space/article';
const ARTICLE_API = 'https://api.bilibili.com/x/article/view';
const PAGE_SIZE = 20;

const COOKIE = process.env.BILIBILI_COOKIE?.trim() || '';

if (COOKIE) {
  console.log('[CONFIG] BILIBILI_COOKIE 已加载 ✔');
} else {
  console.log('[CONFIG] BILIBILI_COOKIE 未设置 — 以匿名身份请求（更容易触发 -352 风控）');
}

// ── 构造与真实 Chrome 浏览器一致的请求头 ────────────────────────────────────
const browserHeaders: Record<string, string> = {
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
 * 获取用户文章列表的一页。
 */
export async function fetchArticleList(mid: string | number, pn = 1): Promise<ArticleListResult> {
  const { data } = await httpClient.get(LIST_API, {
    params: { mid, pn, ps: PAGE_SIZE, sort: 'publish_time' },
  });

  if (data.code !== 0) {
    throw new Error(`API 错误 ${data.code}: ${data.message}`);
  }

  const articles = (data.data?.articles ?? []).map((a: { id: number; title: string }) => ({
    id: a.id,
    title: a.title,
  }));

  const total: number = data.data?.count ?? 0;
  return { articles, total };
}

/**
 * 通过 B站 API 获取文章正文内容。
 */
export async function fetchArticleContent(cvid: number): Promise<string> {
  const { data } = await httpClient.get(ARTICLE_API, {
    params: { id: cvid },
  });

  if (data.code !== 0) {
    throw new Error(`API 错误 ${data.code}: ${data.message}`);
  }

  // 优先使用 data.content（纯文本）；回退到 opus 结构化段落
  const content: string | undefined = data.data?.content;
  if (content) return content;

  // 回退：从 opus 结构化段落中提取文本
  const paragraphs: Array<{
    para_type: number;
    text?: { nodes?: Array<{ word?: { words?: string } }> };
  }> | undefined = data.data?.opus?.content?.paragraphs;

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
