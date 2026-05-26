import { NewsArticle } from '@/types/rss';

/**
 * Safely convert any value to string
 */
function safeText(text: any): string {
  if (!text) return '';
  if (typeof text === 'string') return text;

  // Handle XML parser objects with _ key
  if (typeof text === 'object' && text._) {
    return String(text._);
  }

  // Try to convert to string
  try {
    return String(text);
  } catch (e) {
    return '';
  }
}

/**
 * Generate a URL-safe slug from article title
 */
export function generateSlug(title: string): string {
  const safeTitle = safeText(title);
  return safeTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 100);
}

/**
 * Standard news categories used across the site
 */
const VALID_NEWS_CATEGORIES = [
  'homepage', 'news', 'world', 'business', 'sports',
  'technology', 'entertainment', 'politics', 'health',
];

/**
 * Normalize any RSS-level category tag to a standard news category.
 * Maps arbitrary RSS tags (state names, editorial labels) to proper
 * news sections for clean URL paths and accurate analytics.
 */
export function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase().trim();
  // Direct match
  if (VALID_NEWS_CATEGORIES.includes(lower)) return lower;
  // Common aliases
  if (['sport', 'cricket', 'football', 'tennis', 'hockey', 'ipl', 'f1', 'rugby', 'nba', 'nfl'].includes(lower)) return 'sports';
  if (['tech', 'science', 'gadgets', 'ai', 'startup', 'startups', 'sci-tech', 'cyber', 'software', 'mobile'].includes(lower)) return 'technology';
  if (['bollywood', 'hollywood', 'movies', 'movie', 'music', 'tv', 'celebrity', 'celebrities', 'drama', 'ott', 'streaming'].includes(lower)) return 'entertainment';
  if (['economy', 'finance', 'market', 'markets', 'stock', 'stocks', 'banking', 'corporate', 'industry', 'trade'].includes(lower)) return 'business';
  if (['international', 'global', 'foreign', 'europe', 'asia', 'americas', 'middle east', 'africa'].includes(lower)) return 'world';
  if (['national', 'india', 'domestic', 'local', 'city', 'state'].includes(lower)) return 'news';
  if (['government', 'election', 'elections', 'policy', 'parliament', 'congress', 'democracy', 'law'].includes(lower)) return 'politics';
  if (['medical', 'fitness', 'wellness', 'covid', 'healthcare', 'mental health', 'nutrition', 'diet'].includes(lower)) return 'health';
  // Fallback to 'news'
  return 'news';
}

/**
 * Generate internal article URL under the category hierarchy.
 *
 * URL format: /category/{normalizedCategory}/{slug}?title=...&source=...
 *
 * @param article The news article object
 * @param pageCategory Optional override — the known page-level category
 *   (e.g., from CategoryPage slug or HomePage section). When provided,
 *   this takes priority over normalizing article.category.
 */
export function getArticleUrl(article: NewsArticle, pageCategory?: string): string {
  const slug = generateSlug(article.title);
  const cat = pageCategory || normalizeCategory(safeText(article.category) || 'News');

  const params = new URLSearchParams({
    title: safeText(article.title),
    image: safeText(article.image) || '',
    content: safeText(article.description),
    date: safeText(article.pubDate),
    source: safeText(article.link),
    sourceName: safeText(article.sourceName) || 'News Source',
  });

  return `/category/${cat}/${slug}?${params.toString()}`;
}
