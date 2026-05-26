import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        
        const userId = searchParams.get('userId');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '20', 10);

        if (page < 1 || limit < 1) {
            return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
        }

        const skip = (page - 1) * limit;

        const whereClause: any = {
            user: {
                role: { not: 'admin' }
            }
        };
        if (userId) {
            whereClause.userId = userId;
        }

        // Fetch total count of sessions for pagination metadata
        const total = await prisma.userSession.count({ where: whereClause });

        // Fetch sessions with pagination, relation counts, and distinct pages visited
        const sessionsData = await prisma.userSession.findMany({
            where: whereClause,
            skip,
            take: limit,
            orderBy: { startedAt: 'desc' },
            include: {
                _count: {
                    select: { heatmapEvents: true }
                },
                heatmapEvents: {
                    select: { page: true },
                    distinct: ['page']
                },
                user: {
                    select: { name: true, role: true }
                }
            }
        });

        const formattedSessions = sessionsData.map((session) => {
            // Extract meaningful categories/sections from pages
            const categories = Array.from(new Set(
                session.heatmapEvents
                    .map(e => {
                        const p = e.page;
                        if (p.startsWith('/category/')) return p.split('/')[2];
                        if (p.startsWith('/article/')) return 'Article';
                        if (p === '/') return 'Home';
                        return null; // Ignore purely functional pages like /login in this list
                    })
                    .filter(Boolean)
            ));

            return {
                id: session.id,
                userId: session.userId,
                userName: session.user?.name || session.userId,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                totalDuration: session.totalDuration,
                eventCount: session._count.heatmapEvents,
                aiReport: session.aiReport,
                categories: categories
            };
        });

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            sessions: formattedSessions,
            total,
            page,
            totalPages
        }, { status: 200 });

    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
