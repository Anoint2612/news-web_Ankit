'use client';

import React, { useEffect, useState } from 'react';
import styles from '@/app/category/[slug]/Category.module.css';
import Link from 'next/link';
import { getArticleUrl } from '@/lib/articleUtils';
import { useCountry } from '@/contexts/CountryContext';
import { NewsArticle } from '@/types/rss';
import useSWR from 'swr';
import { NewsSkeleton } from './NewsSkeleton';
import CopyButton from './CopyButton';

const categoryImages: Record<string, string> = {
  entertainment: 'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?auto=format&fit=crop&q=80&w=1200',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200',
  politics: 'https://images.unsplash.com/photo-1529101091760-61df6be34fc8?auto=format&fit=crop&q=80&w=1200',
  business: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=1200',
  technology: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&q=80&w=1200',
};

function getImageUrl(image: string | undefined, fallback: string): string {
  return image || fallback;
}

function formatDate(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toLocaleDateString();

  // Handle XML parser objects with _ key (like from xml2js or cheerio)
  if (typeof date === 'object' && date._) {
    return String(date._);
  }

  // Handle any other object format - try to convert to string safely
  try {
    return String(date);
  } catch (e) {
    return '';
  }
}

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

// Map slug to RSS category
const slugToCategory: Record<string, 'homepage' | 'news' | 'world' | 'business' | 'sports' | 'technology' | 'entertainment' | 'politics' | 'health'> = {
  sports: 'sports',
  business: 'business',
  technology: 'technology',
  entertainment: 'entertainment',
  politics: 'politics',
  world: 'world',
  health: 'health',
  international: 'world',
  environment: 'news',
};

interface CategoryPageProps {
  slug: string;
}


const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch category feeds');
  return res.json();
});

export default function CategoryPage({ slug }: CategoryPageProps) {
  const { countryCode, isLoading: countryLoading } = useCountry();

  const category = slugToCategory[slug] || 'news';
  const { data: articles = [], error, isLoading } = useSWR(
    !countryLoading ? `/api/country-feeds?country=${countryCode}&category=${category}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      fallbackData: []
    }
  );

  const fallbackImage = categoryImages[slug] || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1200';
  const categoryName = slug.charAt(0).toUpperCase() + slug.slice(1);

  if (isLoading || countryLoading) {
    return (
      <div className={styles.container}>
        <NewsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem', color: '#e53e3e' }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '1rem',
              backgroundColor: '#1E293B',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isLoading && !countryLoading && articles.length === 0) {
    return (
      <div className={styles.container}>
        <div style={{ padding: '80px 20px', textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📰</div>
          <h2 style={{ fontFamily: 'var(--font-fraunces)', fontSize: '2rem', marginBottom: '10px' }}>No News found in {categoryName}</h2>
          <p style={{ color: '#64748b', maxWidth: '400px', margin: '0 auto 30px' }}>
            We couldn't find any recent stories for this category in your region. Check back later or try another category.
          </p>
          <Link
            href="/"
            style={{
              padding: '12px 24px',
              backgroundColor: '#1E293B',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
          >
            Back to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const mainArticle = articles[0];

  const trending = articles.slice(1, 5);
  const gridArticles = articles.slice(5, 11);

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <div className={styles.breadcrumb}>Home / {categoryName}</div>
        <h1 className={styles.headerTitle}>{categoryName}</h1>
        <p className={styles.headerDescription}>
          Stay updated with the latest in {slug}. Breaking news, in-depth analysis, and expert perspectives from around the globe.
        </p>

        <div className={styles.featuredGrid}>
          <div style={{ position: 'relative' }}>
            <Link
              href={getArticleUrl(mainArticle)}
              className={styles.featuredMain}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className={styles.featuredImageWrapper}>
                <img
                  src={getImageUrl(mainArticle.image, fallbackImage)}
                  alt={safeText(mainArticle.title)}
                  className={styles.featuredImage}
                />
              </div>
              <div className={styles.featuredContent}>
                <div className={styles.metaTags}>
                  <span>{slug}</span>
                  <span>•</span>
                  <span>{formatDate(mainArticle.pubDate)}</span>
                </div>
                <h2 className={styles.featuredTitle}>{safeText(mainArticle.title)}</h2>
                <p className={styles.featuredExcerpt}>{safeText(mainArticle.description)}</p>
              </div>
            </Link>
            <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
              <CopyButton url={typeof window !== 'undefined' ? window.location.origin + getArticleUrl(mainArticle) : getArticleUrl(mainArticle)} />
            </div>
          </div>

          <aside className={styles.sidebar}>
            <div className={styles.sidebarBlock}>
              <h3 className={styles.sidebarTitle}>Trending in {categoryName}</h3>
              <div className={styles.trendingList}>
                {trending.map((article: NewsArticle, i: number) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <Link
                      href={getArticleUrl(article)}
                      className={styles.trendingItem}
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <div className={styles.trendingMeta}>{i + 1} • Trending</div>
                      <h4 className={styles.trendingTitle}>{safeText(article.title)}</h4>
                    </Link>
                    <div style={{ position: 'absolute', top: '5px', right: '0' }}>
                      <CopyButton size={12} url={typeof window !== 'undefined' ? window.location.origin + getArticleUrl(article) : getArticleUrl(article)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className={styles.articleGridSection}>
        <div className={styles.grid}>
          {gridArticles.map((article: NewsArticle, i: number) => (
            <div key={i} style={{ position: 'relative' }}>
              <Link
                href={getArticleUrl(article)}
                className={styles.gridItem}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div className={styles.gridImageWrapper}>
                  <img
                    src={getImageUrl(article.image, `https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&w=600&q=80`)}
                    alt={safeText(article.title)}
                    className={styles.gridImage}
                  />
                </div>
                <div className={styles.metaTags}>
                  <span>{safeText(article.category) || 'News'}</span>
                  <span>•</span>
                  <span>{formatDate(article.pubDate)}</span>
                </div>
                <h3 className={styles.gridTitle}>{safeText(article.title)}</h3>
                <p className={styles.gridExcerpt}>{safeText(article.description)}</p>
              </Link>
              <div style={{ position: 'absolute', bottom: '15px', right: '0' }}>
                <CopyButton size={14} url={typeof window !== 'undefined' ? window.location.origin + getArticleUrl(article) : getArticleUrl(article)} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
