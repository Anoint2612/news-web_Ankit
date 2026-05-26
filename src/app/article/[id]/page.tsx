import { redirect } from 'next/navigation';
import { normalizeCategory } from '@/lib/articleUtils';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export const dynamic = 'force-dynamic';

/**
 * Legacy /article/[id] route — redirects to the new /category/[slug]/[articleSlug] format.
 * Kept for backward compatibility with old shared links and bookmarks.
 */
export default async function LegacyArticleRedirect({ params, searchParams }: PageProps) {
  const { id } = await params;
  const search = await searchParams;

  // Determine category from the old query param
  const category = search.category || 'News';
  const normalizedCategory = normalizeCategory(category);

  // Rebuild the query string WITHOUT the category (it's now in the path)
  const newParams = new URLSearchParams();
  if (search.title) newParams.set('title', search.title);
  if (search.image) newParams.set('image', search.image);
  if (search.content) newParams.set('content', search.content);
  if (search.snippet) newParams.set('snippet', search.snippet);
  if (search.date) newParams.set('date', search.date);
  if (search.source) newParams.set('source', search.source);
  if (search.sourceName) newParams.set('sourceName', search.sourceName);

  const queryString = newParams.toString();
  const newUrl = `/category/${normalizedCategory}/${id}${queryString ? `?${queryString}` : ''}`;

  redirect(newUrl);
}
