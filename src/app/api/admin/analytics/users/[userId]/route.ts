import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorizeRoles, isAuthorized } from '@/lib/rbac';

async function getMostEngagedCategory(userId: string, startDate: Date) {
  const [clicks, engagements] = await Promise.all([
    prisma.articleClick.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { userId, createdAt: { gte: startDate } },
    }),
    prisma.articleEngagement.groupBy({
      by: ['category'],
      _sum: { timeSpentSeconds: true },
      where: { userId, updatedAt: { gte: startDate } },
    }),
  ]);

  const scores: Record<string, number> = {};
  clicks.forEach((c) => {
    scores[c.category] = (scores[c.category] || 0) + c._count.id * 10;
  });
  engagements.forEach((e) => {
    scores[e.category] = (scores[e.category] || 0) + (e._sum.timeSpentSeconds || 0);
  });

  let topCategory = null;
  let maxScore = -1;
  for (const [cat, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      topCategory = cat;
    }
  }
  return topCategory;
}

export async function GET(
  req: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  const { userId } = await context.params;
  if (!userId) {
    return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
  }

  try {
    const now = new Date();
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const d15 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [cat7, cat15, cat30] = await Promise.all([
      getMostEngagedCategory(userId, d7),
      getMostEngagedCategory(userId, d15),
      getMostEngagedCategory(userId, d30),
    ]);

    const totalClicksByCategoryRaw = await prisma.articleClick.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { userId },
    });

    const totalClicksByCategory = totalClicksByCategoryRaw.map((row) => ({
      category: row.category,
      clicks: row._count.id,
    }));

    const topEngagements = await prisma.articleEngagement.groupBy({
      by: ['articleId'],
      _sum: { timeSpentSeconds: true },
      where: { userId },
      orderBy: { _sum: { timeSpentSeconds: 'desc' } },
      take: 5,
    });

    const articleIds = topEngagements.map((e) => e.articleId);
    const clickRecordsWithTitles = await prisma.articleClick.findMany({
      where: {
        articleId: { in: articleIds },
        title: { not: '' },
      },
      select: { articleId: true, title: true },
      distinct: ['articleId'],
      orderBy: { createdAt: 'desc' },
    });

    const topArticles = topEngagements.map((e) => ({
      articleId: e.articleId,
      title: clickRecordsWithTitles.find((r) => r.articleId === e.articleId)?.title ||
             e.articleId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      timeSpentSeconds: e._sum.timeSpentSeconds || 0,
    }));

    return NextResponse.json({
      mostEngagedCategory: {
        last7Days: cat7,
        last15Days: cat15,
        last30Days: cat30,
      },
      totalClicksByCategory,
      topArticles,
    });
  } catch (error) {
    console.error('USER_ANALYTICS_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
