/** 文章列表 API 中的单条文章元数据 */
export interface ArticleMeta {
  id: number;
  title: string;
}

/** 分页文章列表请求的返回结果 */
export interface ArticleListResult {
  articles: ArticleMeta[];
  total: number;
}

/** 写入文件时的完整文章数据 */
export interface ArticleData {
  cvid: number;
  title: string;
  content: string;
}

/** 日志级别 */
export type LogLevel = 'info' | 'warn' | 'error' | 'skip' | 'match';
