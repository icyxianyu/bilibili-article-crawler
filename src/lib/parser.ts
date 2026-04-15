/**
 * B站专栏文章 HTML 解析器（备用）。
 * 从文章页面 HTML 中提取纯文本正文。
 */

import * as cheerio from 'cheerio';

// 按优先级尝试的 CSS 选择器列表
const SELECTORS = [
  '#read-article-holder',
  '.article-holder',
  '.bili-rich-text',
  '.article-content',
  '#app .article',
];

/**
 * 从 B站文章 HTML 页面中解析纯文本正文。
 * 如果 DOM 选择器都失败，回退到 __INITIAL_STATE__ JSON 提取。
 */
export function parseArticleContent(html: string): string {
  const $ = cheerio.load(html);

  for (const selector of SELECTORS) {
    const el = $(selector);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text.length > 50) {
        return text;
      }
    }
  }

  // 回退：从 window.__INITIAL_STATE__ 中提取
  const stateText = extractInitialState(html);
  if (stateText) return stateText;

  return '';
}

function extractInitialState(html: string): string {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:\(function|<\/script>)/);
  if (!match) return '';

  try {
    const state = JSON.parse(match[1]);
    // 尝试多个已知路径
    const content: string =
      state?.readInfo?.content ??
      state?.articleInfo?.content ??
      state?.article?.content ??
      '';

    if (!content) return '';

    // content 是 HTML 字符串，用 cheerio 解析为纯文本
    const $ = cheerio.load(content);
    return $('body').text().trim();
  } catch {
    return '';
  }
}
