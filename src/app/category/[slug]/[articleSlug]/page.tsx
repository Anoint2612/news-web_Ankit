import styles from '@/app/article/[id]/Article.module.css';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { scrapeFullArticle } from '@/lib/scraper';
import { expandNewsSnippet } from '@/lib/geminiService';
import SocialShare from '@/components/SocialShare';
import CopyButton from '@/components/CopyButton';
import ReadingProgress from '@/components/ReadingProgress';
import ArticleAnalyticsTracker from '@/components/ArticleAnalyticsTracker';
import { Clock, BookOpen } from 'lucide-react';
import { Metadata } from 'next';

interface PageProps {
  params: Promise<{ slug: string; articleSlug: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export const dynamic = 'force-dynamic';

function decodeParam(val: any, fallback = ''): string {
  if (!val) return fallback;
  const str = Array.isArray(val) ? String(val[0]) : String(val);
  try {
    return str.includes('%') ? decodeURIComponent(str) : str;
  } catch {
    return str;
  }
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const search = await searchParams;
  const { slug } = await params;
  const title = decodeParam(search.title, 'News Article');
  const description = decodeParam(search.content || search.snippet, '').substring(0, 160);
  const image = decodeParam(search.image);
  const categoryName = slug.charAt(0).toUpperCase() + slug.slice(1);

  return {
    title: `${title} | ${categoryName} | True Line News`,
    description,
    openGraph: {
      title,
      description,
      images: image ? [image] : [],
      type: 'article',
    },
  };
}

export default async function ArticlePage({ params, searchParams }: PageProps) {
  const { slug: categorySlug, articleSlug } = await params;
  const search = await searchParams;

  // Extract article data from query params
  const title = decodeParam(search.title);
  const image = decodeParam(search.image);
  const snippet = decodeParam(search.content || search.snippet);
  const date = decodeParam(search.date);
  const source = decodeParam(search.source);
  const sourceName = decodeParam(search.sourceName, 'Original Source');

  // Category comes from the URL path — always correct
  const category = categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1);

  // Clean title (remove site names like "| Hindustan Times" or " - The Hindu")
  let displayTitle = title;
  if (displayTitle.includes(' | ')) displayTitle = displayTitle.split(' | ')[0];
  if (displayTitle.includes(' - ')) displayTitle = displayTitle.split(' - ')[0];

  if (!title) {
    notFound();
  }

  // Build clean sharing URL
  const shareParams = new URLSearchParams();
  if (title) shareParams.set('title', title);
  if (image) shareParams.set('image', image);
  if (snippet) shareParams.set('content', snippet);
  if (date) shareParams.set('date', date);
  if (source) shareParams.set('source', source);
  if (sourceName) shareParams.set('sourceName', sourceName);

  const currentPath = `/category/${categorySlug}/${articleSlug}?${shareParams.toString()}`;
  const baseUrl = process.env.NEXTAUTH_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const fullUrl = baseUrl ? `${baseUrl}${currentPath}` : currentPath;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(currentPath)}`);
  }

  let fullContent = '';
  let isFullContent = false;
  let isAiEnhanced = false;
  let wordCount = snippet ? snippet.split(/\s+/).length : 0;

  if (source) {
    try {
      const scraped = await scrapeFullArticle(source);

      const textOnly = scraped?.textContent || '';
      const paragraphCount = scraped?.content?.split('</p>').filter(p => p.trim().length > 50).length || 0;

      // ULTRA-STRICT QUALITY CHECK: 
      // If content is less than 1800 characters OR fewer than 5 paragraphs, 
      // it is considered 'poor quality' and we force AI expansion.
      if (scraped && textOnly.length > 1800 && paragraphCount >= 5) {
        console.log(`✅ Scraped content accepted: ${textOnly.length} chars, ${paragraphCount} paragraphs.`);
        fullContent = scraped.content;
        isFullContent = true;
        wordCount = textOnly.trim().split(/\s+/).length;
      } else {
        console.log(`⚠️ Scraped content considered TOO SHORT (${textOnly.length} chars, ${paragraphCount} paras). FORCING Full AI Expansion...`);
        const expanded = await expandNewsSnippet(displayTitle, snippet, category);
        fullContent = expanded;
        isFullContent = true;
        isAiEnhanced = true;
        wordCount = fullContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
      }
    } catch (err) {
      console.error('Scraping error, falling back to AI:', err);
      const expanded = await expandNewsSnippet(displayTitle, snippet, category);
      fullContent = expanded;
      isFullContent = true;
      isAiEnhanced = true;
      wordCount = fullContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
    }
  } else if (snippet) {
    const expanded = await expandNewsSnippet(displayTitle, snippet, category);
    fullContent = expanded;
    isFullContent = true;
    isAiEnhanced = true;
    wordCount = fullContent.replace(/<[^>]*>/g, '').split(/\s+/).length;
  }

  const readingTime = Math.max(3, Math.ceil(wordCount / 210));

  return (
    <>
      <ArticleAnalyticsTracker articleId={articleSlug} category={categorySlug} title={displayTitle} />
      <ReadingProgress />
      <div className={styles.container}>
        <div className={styles.breadcrumb}>
          <Link href="/">Home</Link> / <Link href={`/category/${categorySlug}`}>{category}</Link> / Article
        </div>

        <article className={styles.article}>
          <div className={styles.header}>
            <div className={styles.category}>{category}</div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{title}</h1>
              <div className={styles.copyBtnWrapper}>
                <CopyButton url={fullUrl} size={20} />
              </div>
            </div>

            <div className={styles.articleStats}>
              <div className={styles.statItem}>
                <Clock size={16} />
                <span>{readingTime} min read</span>
              </div>
              <div className={styles.statItem}>
                <BookOpen size={16} />
                <span>{wordCount} words</span>
              </div>
            </div>

            <div className={styles.meta}>
              <div className={styles.authorGroup}>
                <span className={styles.date}>{date}</span>
                <span className={styles.divider}>•</span>
                <span className={styles.source}>{sourceName}</span>
              </div>
              <div className={styles.shareIconGroup}>
                <SocialShare url={fullUrl} title={title} />
              </div>
            </div>
          </div>

          {image && (
            <div className={styles.imageWrapper}>
              <img src={image} alt={title} className={styles.image} />
            </div>
          )}

          <div className={styles.content}>
            {isAiEnhanced ? (
              <div className={styles.fullStoryBadge} style={{ background: '#f0f9ff', color: '#0369a1', borderColor: '#bae6fd' }}>
                AI Enhanced Report
              </div>
            ) : isFullContent ? (
              <div className={styles.fullStoryBadge}>From Trusted Source</div>
            ) : null}

            {isFullContent ? (
              <div
                className={styles.articleBody}
                dangerouslySetInnerHTML={{ __html: fullContent }}
              />
            ) : (
              <div className={styles.articleBody}>
                {snippet ? snippet.split('\n').map((para, i) => (
                  para.trim() && <p key={i} className={styles.paragraph}>{para.trim()}</p>
                )) : <p>Article content unavailable.</p>}
              </div>
            )}

            <div className={styles.articleShareBottom}>
              <h3>Share this story</h3>
              <SocialShare url={fullUrl} title={title} />
            </div>

            {source && (
              <div className={styles.attribution}>
                <p>Original Source: <a href={source} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{sourceName}</a></p>
              </div>
            )}
          </div>

          <div className={styles.footer}>
            <Link href="/" className={styles.backButton}>
              ← Back to Homepage
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
