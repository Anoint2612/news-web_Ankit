import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorizeRoles, isAuthorized } from '@/lib/rbac';

export async function GET() {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  const [clicksByCategory, topArticles, engagementSummary] = await Promise.all([
    prisma.articleClick.groupBy({
      by: ['category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    prisma.articleClick.groupBy({
      by: ['articleId', 'category'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 20,
    }),
    prisma.articleEngagement.aggregate({
      _sum: { timeSpentSeconds: true },
      _count: { id: true },
      _avg: { timeSpentSeconds: true },
    }),
  ]);

  const recentClicks = await prisma.articleClick.findMany({
    take: 50,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      articleId: true,
      category: true,
      createdAt: true,
      user: { select: { email: true } },
    },
  });

  return NextResponse.json({
    clicksByCategory: clicksByCategory.map((row) => ({
      category: row.category,
      clicks: row._count.id,
    })),
    topArticles: topArticles.map((row) => ({
      articleId: row.articleId,
      category: row.category,
      clicks: row._count.id,
    })),
    engagement: {
      totalRecords: engagementSummary._count.id,
      totalTimeSpentSeconds: engagementSummary._sum.timeSpentSeconds ?? 0,
      avgTimeSpentSeconds: engagementSummary._avg.timeSpentSeconds ?? 0,
    },
    recentClicks,
  });
}
