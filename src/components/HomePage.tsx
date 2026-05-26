'use client';

import { useState } from 'react';
import styles from '@/app/page.module.css';
import Link from 'next/link';
import { getArticleUrl } from '@/lib/articleUtils';
import { useCountry } from '@/contexts/CountryContext';
import { NewsArticle } from '@/types/rss';
import useSWR from 'swr';
import { NewsSkeleton } from './NewsSkeleton';
import CopyButton from './CopyButton';

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1200";

function getImageUrl(image: string | undefined, defaultImage: string): string {
  return image || defaultImage;
}

function formatDate(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toLocaleDateString();
  return String(date);
}

function safeText(text: any): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  if (typeof text === 'object' && text._) return String(text._);
  return String(text);
}


const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch feeds');
  return res.json();
});

export default function HomePage() {
  const { countryCode, isLoading: countryLoading } = useCountry();

  // Use SWR for better caching and performance
  const { data: articles = {}, error, isLoading } = useSWR(
    !countryLoading ? `/api/country-feeds?country=${countryCode}&multiple=homepage,news,business,sports,technology,entertainment,politics,world,health` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      fallbackData: {}
    }
  );

  // Newsletter states
  const [subEmail, setSubEmail] = useState('');
  const [subStatus, setSubStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [subLoading, setSubLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubLoading(true);
    setSubStatus({ type: null, message: '' });

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: subEmail }),
      });
      const data = await res.json();

      if (res.ok) {
        setSubStatus({ type: 'success', message: data.message });
        setSubEmail('');
      } else {
        setSubStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setSubStatus({ type: 'error', message: 'Failed to subscribe. Please try again.' });
    } finally {
      setSubLoading(false);
      // Clear status after 5 seconds
      setTimeout(() => setSubStatus({ type: null, message: '' }), 5000);
    }
  };

  if (isLoading || countryLoading) {
    return (
      <div className={styles.page}>
        <NewsSkeleton />
      </div>
    );
  }

  const news = articles.news || [];
  const business = articles.business || [];
  const tech = articles.technology || [];
  const world = articles.world || [];
  const health = articles.health || [];
  const environment = articles.environment || [];
  const sports = articles.sports || [];

  const all = [...news, ...business, ...tech, ...world, ...health, ...environment, ...sports];

  const heroArticle = news[0] || all[0] || { title: "Latest News", description: "", image: FALLBACK_IMAGE, category: "WORLD" };
  const sidebarHero = all.slice(1, 5);

  const latestMain = business[0] || all[5];
  const latestGrid = all.slice(6, 10);

  const secondaryStories = all.slice(10, 13);

  const mostRead = all.slice(13, 16);

  const worldFeatured = world[0] || all[16];
  const worldSidebar = all.slice(17, 21);

  /**
   * Helper: determine the correct page-level category for a HomePage article.
   * Since articles from different feeds are mixed in `all`, we check which
   * feed array the article was originally from to provide the correct category.
   */
  function getPageCategory(art: NewsArticle): string {
    if (news.includes(art)) return 'news';
    if (business.includes(art)) return 'business';
    if (tech.includes(art)) return 'technology';
    if (world.includes(art)) return 'world';
    if (health.includes(art)) return 'health';
    if (sports.includes(art)) return 'sports';
    if (environment.includes(art)) return 'news';
    return undefined as any; // let getArticleUrl use normalizeCategory fallback
  }

  return (
    <div className={styles.page}>
      <main className={styles.content}>
        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroMain}>
            <div className={styles.heroMainArticle} style={{ position: 'relative' }}>
              <Link href={heroArticle ? getArticleUrl(heroArticle, 'news') : '#'} className={styles.heroLink}>
                <div className={styles.heroMainImageWrapper}>
                  <img src={getImageUrl(heroArticle?.image, FALLBACK_IMAGE)} alt="" className={styles.heroMainImage} />
                </div>
                <span className={styles.category}>{safeText(heroArticle?.category).toUpperCase() || 'TOP STORY'}</span>
                <h1 className={styles.heroMainTitle}>{safeText(heroArticle?.title)}</h1>
                <p className={styles.heroMainDescription}>{safeText(heroArticle?.description)}</p>
                <span className={styles.meta}>{formatDate(heroArticle?.pubDate)} • By Editorial Team</span>
              </Link>
              <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <CopyButton url={heroArticle ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(heroArticle, 'news') : getArticleUrl(heroArticle, 'news')) : ''} />
              </div>
            </div>
          </div>
          <div className={styles.heroSidebar}>
            {sidebarHero.map((art, i) => (
              <div key={i} className={styles.sidebarItemContainer}>
                <Link href={art ? getArticleUrl(art, getPageCategory(art)) : '#'} className={styles.sidebarItem}>
                  <div className={styles.sidebarImageWrapper}>
                    <img src={getImageUrl(art?.image, FALLBACK_IMAGE)} alt="" className={styles.sidebarImage} />
                  </div>
                  <div className={styles.sidebarContent}>
                    <h3 className={styles.sidebarTitle}>{safeText(art?.title)}</h3>
                    <span className={styles.meta}>{formatDate(art?.pubDate)}</span>
                  </div>
                </Link>
                <div className={styles.itemCopyBtn}>
                  <CopyButton size={14} url={art ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(art, getPageCategory(art)) : getArticleUrl(art, getPageCategory(art))) : ''} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Latest News */}
        <section className={styles.latestNewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Latest News</h2>
            <Link href="/category/news" className={styles.viewAllBtn}>View All</Link>
          </div>
          <div className={styles.latestNewsGrid}>
            <div style={{ position: 'relative' }}>
              <Link href={latestMain ? getArticleUrl(latestMain, 'business') : '#'} className={styles.latestLargeCard}>
                <div className={styles.latestLargeImageWrapper}>
                  <img src={getImageUrl(latestMain?.image, FALLBACK_IMAGE)} alt="" className={styles.latestLargeImage} />
                </div>
                <span className={styles.category}>{safeText(latestMain?.category) || 'NEWS'}</span>
                <h3 className={styles.latestLargeTitle}>{safeText(latestMain?.title)}</h3>
              </Link>
              <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                <CopyButton url={latestMain ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(latestMain, 'business') : getArticleUrl(latestMain, 'business')) : ''} />
              </div>
            </div>
            <div className={styles.latestSmallGrid}>
              {latestGrid.map((art, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <Link href={art ? getArticleUrl(art, getPageCategory(art)) : '#'} className={styles.latestSmallCard}>
                    <div className={styles.latestSmallImageWrapper}>
                      <img src={getImageUrl(art?.image, FALLBACK_IMAGE)} alt="" className={styles.latestSmallImage} />
                    </div>
                    <h3 className={styles.latestSmallTitle}>{safeText(art?.title)}</h3>
                    <span className={styles.meta}>{formatDate(art?.pubDate)}</span>
                  </Link>
                  <div style={{ position: 'absolute', top: '5px', right: '5px' }}>
                    <CopyButton size={12} url={art ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(art, getPageCategory(art)) : getArticleUrl(art, getPageCategory(art))) : ''} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Secondary Stories */}
        <section className={styles.secondaryStoriesSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Secondary Stories</h2>
            <Link href="/category/all" className={styles.viewAllBtn}>View All</Link>
          </div>
          <div className={styles.secondaryStoriesGrid}>
            {secondaryStories.map((art, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <Link href={art ? getArticleUrl(art, getPageCategory(art)) : '#'} className={styles.secondaryCard}>
                  <img src={getImageUrl(art?.image, FALLBACK_IMAGE)} alt="" className={styles.secondaryImage} />
                  <div className={styles.secondaryOverlay}>
                    <span className={styles.category} style={{ color: '#fff' }}>{safeText(art?.category) || 'FEATURED'}</span>
                    <h3 className={styles.secondaryCardTitle}>{safeText(art?.title)}</h3>
                    <span className={styles.meta} style={{ color: 'rgba(255,255,255,0.7)' }}>{formatDate(art?.pubDate)}</span>
                  </div>
                </Link>
                <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>
                  <CopyButton url={art ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(art, getPageCategory(art)) : getArticleUrl(art, getPageCategory(art))) : ''} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Most Read News */}
        <section className={styles.mostReadSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Most Read News</h2>
          </div>
          <div className={styles.mostReadList}>
            {mostRead.map((art, i) => (
              <div key={i} className={styles.mostReadItem}>
                <div className={styles.mostReadContent}>
                  <span className={styles.meta}>{formatDate(art?.pubDate)} • {safeText(art?.category) || 'TRENDING'}</span>
                  <h3 className={styles.mostReadTitle}>{safeText(art?.title)}</h3>
                  <p className={styles.heroMainDescription} style={{ fontSize: '1rem', marginBottom: '1.5rem' }}>{safeText(art?.description)}</p>
                  <Link href={art ? getArticleUrl(art, getPageCategory(art)) : '#'} className={styles.readMoreBtn}>Read More</Link>
                </div>
                <div className={styles.mostReadImageWrapper}>
                  <img src={getImageUrl(art.image, FALLBACK_IMAGE)} alt="" className={styles.mostReadImage} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* World News */}
        <section className={styles.worldNewsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>World News</h2>
          </div>
          <div className={styles.worldNewsGrid}>
            <div className={styles.worldSidebar}>
              {worldSidebar.map((art, i) => (
                <Link key={i} href={art ? getArticleUrl(art, 'world') : '#'} className={styles.sidebarItem}>
                  <div className={styles.sidebarImageWrapper}>
                    <img src={getImageUrl(art?.image, FALLBACK_IMAGE)} alt="" className={styles.sidebarImage} />
                  </div>
                  <div>
                    <h3 className={styles.sidebarTitle}>{safeText(art?.title)}</h3>
                    <span className={styles.meta}>{formatDate(art?.pubDate)}</span>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ position: 'relative' }}>
              <Link href={worldFeatured ? getArticleUrl(worldFeatured, 'world') : '#'} className={styles.worldFeatured}>
                <div className={styles.worldFeaturedImageWrapper}>
                  <img src={getImageUrl(worldFeatured?.image, FALLBACK_IMAGE)} alt="" className={styles.worldFeaturedImage} />
                </div>
                <h3 className={styles.worldFeaturedTitle}>{safeText(worldFeatured?.title)}</h3>
                <p className={styles.heroMainDescription}>{safeText(worldFeatured?.description)}</p>
                <div className={styles.authorLine}>
                  <img src={`https://i.pravatar.cc/150?u=${worldFeatured?.title}`} alt="" className={styles.authorAvatar} />
                  <span className={styles.meta} style={{ color: '#000', fontWeight: 'bold' }}>Editorial Team</span>
                  <span className={styles.meta}>{formatDate(worldFeatured?.pubDate)}</span>
                </div>
              </Link>
              <div style={{ position: 'absolute', top: '20px', right: '20px' }}>
                <CopyButton url={worldFeatured ? (typeof window !== 'undefined' ? window.location.origin + getArticleUrl(worldFeatured, 'world') : getArticleUrl(worldFeatured, 'world')) : ''} />
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Section */}
        <section className={styles.subscribeSection}>
          <img src="https://images.unsplash.com/photo-1553284965-83fd3e82fa5a?auto=format&fit=crop&q=80&w=2000" alt="" className={styles.subscribeBg} />
          <div className={styles.subscribeContent}>
            <h2 className={styles.subscribeTitle}>The stories that matter, delivered daily.</h2>
            <p className={styles.subscribeSubtitle}>Join 50,000+ readers who start their day with True Line News. Essential reporting, expert analysis, and a world of perspective.</p>
            <form className={styles.subscribeForm} onSubmit={handleSubscribe}>
              <input
                type="email"
                placeholder="Email Address"
                className={styles.subscribeInput}
                value={subEmail}
                onChange={(e) => setSubEmail(e.target.value)}
                required
                disabled={subLoading}
              />
              <button type="submit" className={styles.subscribeButton} disabled={subLoading}>
                {subLoading ? 'Joining...' : 'Subscribe'}
              </button>
            </form>
            {subStatus.type && (
              <p className={`${styles.subMsg} ${subStatus.type === 'success' ? styles.subSuccess : styles.subError}`}>
                {subStatus.message}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
