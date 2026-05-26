import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorizeRoles, isAuthorized } from '@/lib/rbac';

export async function GET(req: Request) {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const daysParam = searchParams.get('days');
    const days = daysParam && !isNaN(parseInt(daysParam)) ? parseInt(daysParam) : 30;
    
    const now = new Date();
    const dFilter = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Trending Articles (top 5 filtered by timeframe)
    // We get the top articleIds by click count, then fetch their titles
    // from the click records themselves (articles aren't stored in Article table for RSS)
    const topArticlesRaw = await prisma.articleClick.groupBy({
      by: ['articleId'],
      where: { createdAt: { gte: dFilter } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const articleIds = topArticlesRaw.map((a) => a.articleId);

    // Get the most recent click record for each articleId to extract the title and category
    const clickRecordsWithTitles = await prisma.articleClick.findMany({
      where: {
        articleId: { in: articleIds },
        title: { not: '' },
      },
      select: { articleId: true, title: true, category: true },
      distinct: ['articleId'],
      orderBy: { createdAt: 'desc' },
    });

    const engagementForArticles = await prisma.articleEngagement.groupBy({
      by: ['articleId'],
      where: { articleId: { in: articleIds }, updatedAt: { gte: dFilter } },
      _avg: { timeSpentSeconds: true }
    });

    const trendingArticles = topArticlesRaw.map((a) => {
      const clickRecord = clickRecordsWithTitles.find((r) => r.articleId === a.articleId);
      const engagement = engagementForArticles.find(e => e.articleId === a.articleId);
      const articleCategory = clickRecord?.category || 'news';
      return {
        articleId: a.articleId,
        title: clickRecord?.title || a.articleId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        url: `/category/${articleCategory}/${a.articleId}`,
        visits: a._count.id,
        avgTime: engagement?._avg.timeSpentSeconds || 0,
      };
    });

    // 2. Category Distribution
    const categoryVisitsRaw = await prisma.articleClick.groupBy({
      by: ['category'],
      where: { createdAt: { gte: dFilter } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    
    const categoryEngagementRaw = await prisma.articleEngagement.groupBy({
      by: ['category'],
      where: { updatedAt: { gte: dFilter } },
      _avg: { timeSpentSeconds: true }
    });

    const categoryDistribution = categoryVisitsRaw.map((cat) => {
      const engagement = categoryEngagementRaw.find(e => e.category === cat.category);
      return {
        category: cat.category,
        visits: cat._count.id,
        avgTime: engagement?._avg.timeSpentSeconds || 0
      };
    });

    // 3. User Growth (New users in last 30 days)
    const newUsers = await prisma.user.count({
      where: {
        createdAt: { gte: d30 },
      },
    });

    // 4. Active Users (Unique users who generated a click or engagement in last 7 days)
    const [activeClicks, activeEngagements] = await Promise.all([
      prisma.articleClick.findMany({
        where: { createdAt: { gte: d7 }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.articleEngagement.findMany({
        where: { updatedAt: { gte: d7 }, userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const activeUserSet = new Set<string>();
    activeClicks.forEach((c) => {
      if (c.userId) activeUserSet.add(c.userId);
    });
    activeEngagements.forEach((e) => {
      if (e.userId) activeUserSet.add(e.userId);
    });
    const activeUsers = activeUserSet.size;

    return NextResponse.json({
      trendingArticles,
      categoryDistribution,
      userGrowthAndActivity: {
        newUsersLast30Days: newUsers,
        activeUsersLast7Days: activeUsers,
      },
    });
  } catch (error) {
    console.error('DASHBOARD_ANALYTICS_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
