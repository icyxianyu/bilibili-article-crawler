/**
 * HTML parser for Bilibili article pages.
 * Extracts plain text content from the article body.
 */

import * as cheerio from 'cheerio';

// Ordered list of CSS selectors to try
const SELECTORS = [
  '#read-article-holder',
  '.article-holder',
  '.bili-rich-text',
  '.article-content',
  '#app .article',
];

/**
 * Parse plain-text body from a Bilibili article HTML page.
 * Falls back to __INITIAL_STATE__ JSON if DOM selectors fail.
 *
 * @param {string} html
 * @returns {string} plain text content, or empty string if nothing found
 */
export function parseArticleContent(html) {
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

  // Fallback: extract from window.__INITIAL_STATE__
  const stateText = extractInitialState(html);
  if (stateText) return stateText;

  return '';
}

function extractInitialState(html) {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*(?:\(function|<\/script>)/);
  if (!match) return '';

  try {
    const state = JSON.parse(match[1]);
    // Try multiple known paths
    const content =
      state?.readInfo?.content ??
      state?.articleInfo?.content ??
      state?.article?.content ??
      '';

    if (!content) return '';

    // content is an HTML string; parse with cheerio to get plain text
    const $ = cheerio.load(content);
    return $('body').text().trim();
  } catch {
    return '';
  }
}
