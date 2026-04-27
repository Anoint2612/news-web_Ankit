import Parser from 'rss-parser';
import { RSSFeed, RSSFeedItem, NewsArticle, FeedCategory } from '@/types/rss';
import { RSS_FEEDS, CACHE_DURATION } from '@/config/rssFeeds';
import { CountryCode, getFeedUrlsForCountry } from '@/config/multiTenantFeeds';
import { prisma } from '@/lib/prisma';

interface CacheEntry {
  data: RSSFeed;
  timestamp: number;
}

// In-memory cache
const cache = new Map<FeedCategory, CacheEntry>();

// Create parser instance
const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'media:content', { keepArray: true }],
      ['media:thumbnail', 'media:thumbnail'],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'content:encoded'],
    ],
  },
});

function cleanFeedTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\|\s*RSS.*$/i, '')
    .replace(/RSS\s*Feed/gi, '')
    .replace(/\s*-\s*Top Stories.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostnameToSourceName(hostname: string): string {
  const host = hostname.replace(/^www\./, '').toLowerCase();
  if (host.includes('thehindu')) return 'The Hindu';
  if (host.includes('indiatimes')) return 'Times of India';
  if (host.includes('indianexpress')) return 'Indian Express';
  if (host.includes('hindustantimes')) return 'Hindustan Times';
  if (host.includes('ndtv')) return 'NDTV';
  if (host.includes('news18')) return 'News18';
  if (host.includes('theprint')) return 'The Print';
  if (host.includes('telegraphindia')) return 'The Telegraph';
  if (host.includes('deccanherald')) return 'Deccan Herald';
  if (host.includes('livemint')) return 'Mint';
  if (host.includes('economictimes')) return 'The Economic Times';
  if (host.includes('bbc')) return 'BBC';
  if (host.includes('reuters')) return 'Reuters';
  if (host.includes('aljazeera')) return 'Al Jazeera';
  if (host.includes('cnn')) return 'CNN';
  return host.split('.').filter(Boolean)[0]?.toUpperCase() || 'News Source';
}

function extractSourceName(feedTitle?: string, feedUrl?: string, articleUrl?: string): string {
  const cleanedTitle = cleanFeedTitle(feedTitle);
  if (cleanedTitle) return cleanedTitle;

  const candidateUrls = [articleUrl, feedUrl].filter(Boolean) as string[];
  for (const url of candidateUrls) {
    try {
      const hostname = new URL(url).hostname;
      return hostnameToSourceName(hostname);
    } catch {
      continue;
    }
  }

  return 'News Source';
}

/**
 * Extract image URL from RSS feed item
 */
function normalizeImageUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

function extractImageFromHtml(html?: string): string | undefined {
  if (!html) return undefined;

  const srcMatch = html.match(/<img[^>]+(?:src|data-src)=['"]([^'">]+)['"]/i);
  const srcsetMatch = html.match(/<img[^>]+srcset=['"]([^'"]+)['"]/i);

  if (srcMatch?.[1]) {
    const normalized = normalizeImageUrl(srcMatch[1]);
    if (normalized) return normalized;
  }

  if (srcsetMatch?.[1]) {
    const firstSrc = srcsetMatch[1].split(',')[0]?.trim().split(/\s+/)[0];
    const normalized = normalizeImageUrl(firstSrc);
    if (normalized) return normalized;
  }

  return undefined;
}

function extractImageUrl(item: any): string | undefined {
  // Try The Hindu's media:content format first
  if (item['media:content']?.$?.url || item['media:content']?.url) {
    const normalized = normalizeImageUrl(item['media:content']?.$?.url || item['media:content']?.url);
    if (normalized) return normalized;
  }

  // Try media:content as array
  if (Array.isArray(item['media:content']) && (item['media:content'][0]?.$?.url || item['media:content'][0]?.url)) {
    const normalized = normalizeImageUrl(item['media:content'][0]?.$?.url || item['media:content'][0]?.url);
    if (normalized) return normalized;
  }

  // Try enclosure
  if (item.enclosure?.url) {
    const normalized = normalizeImageUrl(item.enclosure.url);
    if (normalized) return normalized;
  }

  // Try media:thumbnail
  if (item['media:thumbnail']?.$?.url || item['media:thumbnail']?.url) {
    const normalized = normalizeImageUrl(item['media:thumbnail']?.$?.url || item['media:thumbnail']?.url);
    if (normalized) return normalized;
  }

  // Try content:encoded for images
  const encodedImage = extractImageFromHtml(item['content:encoded']);
  if (encodedImage) return encodedImage;

  // Try to extract image from description HTML
  const descriptionImage = extractImageFromHtml(item.description);
  if (descriptionImage) return descriptionImage;

  // Try content for images
  const contentImage = extractImageFromHtml(item.content);
  if (contentImage) return contentImage;

  // Return undefined if no image found (will use fallback in components)
  return undefined;
}

/**
 * Extract plain text from HTML description
 */
function extractPlainText(html: string): string {
  if (!html) return '';

  // Remove HTML tags
  const text = html.replace(/<[^>]*>/g, ' ');

  // Decode HTML entities
  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Clean up extra whitespace
  return decoded.replace(/\s+/g, ' ').trim();
}

/**
 * Calculate estimated reading time
 */
function calculateReadTime(text: string): string {
  const wordsPerMinute = 200;
  const words = text.split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return `${minutes} Min`;
}

/**
 * Format date to readable string
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      return date.toLocaleDateString('en-US', options);
    }
  } catch (error) {
    return dateString;
  }
}

/**
 * Fetch RSS feed with caching
 */
export async function fetchRSSFeed(category: FeedCategory): Promise<RSSFeed> {
  // Check cache
  const cached = cache.get(category);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const feedUrl = RSS_FEEDS[category];
    const feed = await parser.parseURL(feedUrl);

    const feedSourceName = extractSourceName(feed.title, feedUrl);

    const rssFeed: RSSFeed = {
      items: feed.items.map((item: any) => {
        // Extract image URL from the item
        const imageUrl = extractImageUrl(item);

        return {
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          description: item.description || '',
          content: item.content || '',
          contentSnippet: item.contentSnippet || '',
          guid: item.guid || item.link,
          categories: item.categories || [],
          isoDate: item.isoDate || '',
          enclosure: imageUrl ? { url: imageUrl } : item.enclosure,
          sourceName: extractSourceName(feedSourceName, feedUrl, item.link),
        };
      }),
      title: feed.title,
      description: feed.description,
      link: feed.link,
    };

    // Update cache
    cache.set(category, {
      data: rssFeed,
      timestamp: Date.now(),
    });

    return rssFeed;
  } catch (error) {
    console.error(`Error fetching RSS feed for ${category}:`, error);

    // Return cached data if available, even if expired
    if (cached) {
      return cached.data;
    }

    // Return empty feed as fallback
    return {
      items: [],
      title: category,
      description: '',
      link: '',
    };
  }
}

/**
 * Convert RSS feed items to NewsArticle format
 */
export function convertToNewsArticles(items: RSSFeedItem[], sourceName?: string): NewsArticle[] {
  return items.map((item) => {
    const plainText = extractPlainText(item.description || item.contentSnippet || '');

    return {
      title: item.title,
      link: item.link,
      pubDate: formatDate(item.pubDate || item.isoDate || ''),
      description: plainText,
      image: extractImageUrl(item),
      category: item.categories?.[0] || 'News',
      readTime: calculateReadTime(plainText),
      sourceName: item.sourceName || sourceName,
    };
  });
}

/**
 * Fetch multiple feeds at once
 */
export async function fetchMultipleFeeds(categories: FeedCategory[]): Promise<Record<FeedCategory, RSSFeed>> {
  const feeds = await Promise.all(
    categories.map(async (category) => ({
      category,
      feed: await fetchRSSFeed(category),
    }))
  );

  return feeds.reduce((acc, { category, feed }) => {
    acc[category] = feed;
    return acc;
  }, {} as Record<FeedCategory, RSSFeed>);
}

const urlCache = new Map<string, { data: RSSFeed; timestamp: number }>();
const articleImageCache = new Map<string, { image?: string; timestamp: number }>();

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOgImageForArticle(articleUrl: string): Promise<string | undefined> {
  const cached = articleImageCache.get(articleUrl);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.image;
  }

  try {
    const res = await fetchWithTimeout(articleUrl, 7000);
    if (!res.ok) return undefined;
    const html = await res.text();

    const ogMatch = html.match(/<meta[^>]+property=['"]og:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i)
      || html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+property=['"]og:image['"][^>]*>/i);
    const twitterMatch = html.match(/<meta[^>]+name=['"]twitter:image['"][^>]+content=['"]([^'"]+)['"][^>]*>/i)
      || html.match(/<meta[^>]+content=['"]([^'"]+)['"][^>]+name=['"]twitter:image['"][^>]*>/i);

    const image = normalizeImageUrl(ogMatch?.[1] || twitterMatch?.[1]);
    articleImageCache.set(articleUrl, { image, timestamp: Date.now() });
    return image;
  } catch {
    return undefined;
  }
}

/**
 * Fetch RSS feed from a specific URL (for multi-tenant feeds)
 */
export async function fetchRSSFromUrl(url: string): Promise<RSSFeed> {
  // Check cache
  const cached = urlCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const feed = await parser.parseURL(url);

    const feedSourceName = extractSourceName(feed.title, url);

    const rssFeed: RSSFeed = {
      items: feed.items.map((item: any) => {
        const imageUrl = extractImageUrl(item);

        return {
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          description: item.description || '',
          content: item.content || '',
          contentSnippet: item.contentSnippet || '',
          guid: item.guid || item.link,
          categories: item.categories || [],
          isoDate: item.isoDate || '',
          enclosure: imageUrl ? { url: imageUrl } : item.enclosure,
          sourceName: extractSourceName(feedSourceName, url, item.link),
        };
      }),
      title: feed.title,
      description: feed.description,
      link: feed.link,
    };

    // Update cache
    urlCache.set(url, {
      data: rssFeed,
      timestamp: Date.now(),
    });

    return rssFeed;
  } catch (error) {
    console.error(`Error fetching RSS feed from ${url}:`, error);

    // Return cached data if available, even if expired
    if (cached) {
      return cached.data;
    }

    return {
      items: [],
      title: 'News',
      description: '',
      link: '',
    };
  }
}

/**
 * Fetch country-specific feeds for a category
 */
export async function fetchCountryFeeds(
  countryCode: CountryCode,
  category: 'homepage' | 'news' | 'world' | 'business' | 'sports' | 'technology' | 'entertainment' | 'politics' | 'health'
): Promise<NewsArticle[]> {
  let feedUrls: string[] = [];

  try {
    // Try to get feeds from the database first
    const dbSources = await prisma.newsSource.findMany({
      where: {
        country: countryCode,
        category: category,
        active: true
      }
    });

    if (dbSources.length > 0) {
      feedUrls = dbSources.map((s: any) => s.url);
    } else {
      // Fallback to static config
      feedUrls = getFeedUrlsForCountry(countryCode, category);
    }
  } catch (err) {
    console.error('Error fetching feeds from DB, falling back to static:', err);
    feedUrls = getFeedUrlsForCountry(countryCode, category);
  }

  // Some countries may not define dedicated entertainment feeds yet.
  // Fallback to general news/homepage feeds so the page never appears empty.
  if (feedUrls.length === 0 && category === 'entertainment') {
    const newsFallback = getFeedUrlsForCountry(countryCode, 'news');
    const homepageFallback = getFeedUrlsForCountry(countryCode, 'homepage');
    feedUrls = [...newsFallback, ...homepageFallback];
  }

  if (feedUrls.length === 0) {
    console.log(`No feeds found for ${countryCode} - ${category}`);
    return [];
  }

  // Fetch all feeds for this country and category
  const allFeeds = await Promise.all(
    feedUrls.map(url => fetchRSSFromUrl(url))
  );

  // Combine all items from all sources
  const allItems: RSSFeedItem[] = allFeeds.flatMap(feed => feed.items);

  // Sort by date (most recent first)
  allItems.sort((a, b) => {
    const dateA = new Date(a.isoDate || a.pubDate || 0);
    const dateB = new Date(b.isoDate || b.pubDate || 0);
    return dateB.getTime() - dateA.getTime();
  });

  // Enrich missing images from article metadata (og:image/twitter:image).
  // We only do this for the first batch to avoid slowing down large feeds.
  const candidates = allItems.filter((item) => !extractImageUrl(item) && item.link).slice(0, 20);
  await Promise.all(
    candidates.map(async (item) => {
      const ogImage = await fetchOgImageForArticle(item.link);
      if (ogImage) {
        item.enclosure = { url: ogImage };
      }
    })
  );

  // Convert to NewsArticle format
  return convertToNewsArticles(allItems);
}

/**
 * Fetch multiple country-specific categories at once
 */
export async function fetchMultipleCountryFeeds(
  countryCode: CountryCode,
  categories: Array<'homepage' | 'news' | 'world' | 'business' | 'sports' | 'technology' | 'entertainment' | 'politics' | 'health'>
): Promise<Record<string, NewsArticle[]>> {
  const feeds = await Promise.all(
    categories.map(async (category) => ({
      category,
      articles: await fetchCountryFeeds(countryCode, category),
    }))
  );

  return feeds.reduce((acc, { category, articles }) => {
    acc[category] = articles;
    return acc;
  }, {} as Record<string, NewsArticle[]>);
}
