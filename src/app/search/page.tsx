'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import styles from '@/app/category/[slug]/Category.module.css';
import searchStyles from './Search.module.css';
import Link from 'next/link';
import { getArticleUrl } from '@/lib/articleUtils';
import { useCountry } from '@/contexts/CountryContext';
import { NewsArticle } from '@/types/rss';
import { NewsSkeleton } from '@/components/NewsSkeleton';
import { Search } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

function SearchResults() {
    const searchParams = useSearchParams();
    const query = searchParams.get('q');
    const { countryCode } = useCountry();

    const { data: results = [], isLoading, error } = useSWR(
        query ? `/api/search?q=${encodeURIComponent(query)}&country=${countryCode}` : null,
        fetcher
    );

    if (!query) {
        return (
            <div className={searchStyles.page}>
                <div className={searchStyles.content} style={{ textAlign: 'center' }}>
                    <h1 className={searchStyles.emptyTitle}>Search News</h1>
                    <p className={searchStyles.subheading} style={{ justifyContent: 'center' }}>Enter a keyword to start searching.</p>
                </div>
            </div>
        );
    }

    if (isLoading) return <NewsSkeleton />;

    return (
        <div className={searchStyles.page}>
            <div className={searchStyles.content}>
                <div style={{ marginBottom: '40px' }}>
                    <h1 className={searchStyles.heading}>
                    Search Results
                    </h1>
                    <p className={searchStyles.subheading}>
                        <Search size={16} /> Results for "{query}" in {countryCode.replace('_', ' ')}
                    </p>
                </div>

                {results.length === 0 ? (
                    <div className={searchStyles.emptyState}>
                        <p style={{ fontSize: '1.25rem', color: '#64748b' }}>No articles found for your search.</p>
                        <Link href="/" className={searchStyles.homeLink}>
                            Return to Homepage
                        </Link>
                    </div>
                ) : (
                    <div className={styles.grid}>
                        {results.map((art: NewsArticle, i: number) => (
                            <Link key={i} href={getArticleUrl(art)} className={styles.gridItem}>
                                <div className={styles.gridImageWrapper}>
                                    <img src={art.image || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=800'} alt="" className={styles.gridImage} />
                                </div>
                                <div className={styles.featuredContent}>
                                    <span className={styles.metaTags}>{art.category || 'NEWS'}</span>
                                    <h3 className={styles.gridTitle}>{art.title}</h3>
                                    <p className={styles.gridExcerpt}>{art.description}</p>
                                    <span className={styles.trendingMeta}>{art.pubDate}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SearchPage() {
    return (
        <Suspense fallback={<NewsSkeleton />}>
            <SearchResults />
        </Suspense>
    );
}
