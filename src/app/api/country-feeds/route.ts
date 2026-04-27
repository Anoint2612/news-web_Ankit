import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { fetchCountryFeeds, fetchMultipleCountryFeeds } from '@/lib/rssParser';
import { CountryCode } from '@/config/multiTenantFeeds';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const countryCode = searchParams.get('country') as CountryCode;
    const category = searchParams.get('category') as 'homepage' | 'news' | 'world' | 'business' | 'sports' | 'technology' | 'entertainment' | 'politics' | 'health';
    const multiple = searchParams.get('multiple');

    if (!countryCode) {
      return NextResponse.json(
        { error: 'Country code is required' },
        { status: 400 }
      );
    }

    if (multiple) {
      // Fetch multiple categories
      const categories = multiple.split(',') as Array<'homepage' | 'news' | 'world' | 'business' | 'sports' | 'technology' | 'entertainment' | 'politics' | 'health'>;
      const feeds = await fetchMultipleCountryFeeds(countryCode, categories);

      return NextResponse.json(feeds, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        },
      });
    } else if (category) {
      // Fetch single category
      const articles = await fetchCountryFeeds(countryCode, category);

      return NextResponse.json(articles, {
        headers: {
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Either category or multiple parameter is required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error fetching country feeds:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feeds' },
      { status: 500 }
    );
  }
}
