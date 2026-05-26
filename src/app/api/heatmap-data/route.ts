import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        
        const page = searchParams.get('page');
        const type = searchParams.get('type') || 'click';
        const days = parseInt(searchParams.get('days') || '7', 10);
        const userId = searchParams.get('userId');

        if (!page) {
            return NextResponse.json({ error: 'page is required' }, { status: 400 });
        }

        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - days);

        // Build the where clause for events
        const whereClause: any = {
            page,
            type,
            timestamp: { gte: dateLimit }
        };

        if (userId) {
            whereClause.userId = userId;
        }

        // 1. Fetch events for the specific page
        const eventsData = await prisma.heatmapEvent.findMany({
            where: whereClause,
            select: { x: true, y: true, scrollDepth: true, userId: true, timestamp: true },
            orderBy: { timestamp: 'desc' }
        });

        // 2. Fetch top 5 most active pages overall
        const topPagesData = await prisma.heatmapEvent.groupBy({
            by: ['page'],
            where: { timestamp: { gte: dateLimit } },
            _count: { page: true },
            orderBy: { _count: { page: 'desc' } },
            take: 5,
        });

        const topPages = topPagesData.map((p) => ({
            page: p.page,
            count: p._count.page
        }));

        // 3. Calculate stats
        const totalEvents = eventsData.length;
        const uniqueUsers = new Set(eventsData.map(e => e.userId)).size;

        let avgScrollDepth = 0;
        const scrollEvents = eventsData.filter(e => e.scrollDepth !== null);
        if (scrollEvents.length > 0) {
            const sum = scrollEvents.reduce((acc, e) => acc + (e.scrollDepth || 0), 0);
            avgScrollDepth = Math.round(sum / scrollEvents.length);
        }

        // 4. Calculate click hotspots (clustering within 5% radius)
        const clickHotspots: { x: number; y: number; count: number }[] = [];
        
        if (type === 'click') {
            for (const ev of eventsData) {
                if (ev.x === null || ev.y === null) continue;
                
                let found = false;
                for (const spot of clickHotspots) {
                    // Calculate Euclidean distance
                    const dx = spot.x - ev.x;
                    const dy = spot.y - ev.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance <= 5) {
                        spot.count++;
                        
                        // Update centroid to keep it accurate
                        spot.x = ((spot.x * (spot.count - 1)) + ev.x) / spot.count;
                        spot.y = ((spot.y * (spot.count - 1)) + ev.y) / spot.count;
                        
                        found = true;
                        break;
                    }
                }
                
                if (!found) {
                    clickHotspots.push({ x: ev.x, y: ev.y, count: 1 });
                }
            }
            
            // Sort by count descending and take top 10
            clickHotspots.sort((a, b) => b.count - a.count);
        }

        const topHotspots = clickHotspots.slice(0, 10);

        return NextResponse.json({
            events: eventsData,
            stats: {
                totalEvents,
                uniqueUsers,
                avgScrollDepth,
                topPages,
                clickHotspots: topHotspots
            }
        }, { status: 200 });

    } catch (error) {
        console.error('Failed to fetch heatmap data:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
