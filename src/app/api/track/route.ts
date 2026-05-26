import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const VALID_TYPES = new Set(['click', 'mousemove', 'scroll']);

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || '';
        let body;

        // Support both standard JSON requests and navigator.sendBeacon (text/plain)
        if (contentType.includes('application/json')) {
            body = await req.json();
        } else {
            const text = await req.text();
            try {
                body = JSON.parse(text);
            } catch (e) {
                return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
            }
        }

        if (!body || !Array.isArray(body.events)) {
            return NextResponse.json({ error: 'Invalid payload: events array is required' }, { status: 400 });
        }

        const validEvents = body.events
            .filter((event: any) => VALID_TYPES.has(event.type) && event.userId && event.page)
            .map((event: any) => {
                let x = typeof event.x === 'number' ? event.x : undefined;
                let y = typeof event.y === 'number' ? event.y : undefined;

                // Sanitize x and y to be between 0 and 100
                if (x !== undefined) x = Math.max(0, Math.min(100, x));
                if (y !== undefined) y = Math.max(0, Math.min(100, y));

                // Serialize viewport object to JSON string if needed
                const viewport = typeof event.viewport === 'object' && event.viewport !== null
                    ? JSON.stringify(event.viewport)
                    : String(event.viewport || '{}');

                return {
                    type: String(event.type),
                    page: String(event.page),
                    userId: String(event.userId),
                    sessionId: event.sessionId ? String(event.sessionId) : null,
                    x,
                    y,
                    // Handle both depth and scrollDepth depending on how client sends it
                    scrollDepth: typeof event.depth === 'number' ? event.depth : (typeof event.scrollDepth === 'number' ? event.scrollDepth : undefined),
                    viewport,
                    timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
                };
            });

        if (validEvents.length === 0) {
            // Return success if nothing to insert, avoiding unnecessary DB calls
            return NextResponse.json({ ok: true, inserted: 0 }, { status: 200 });
        }

        // Bulk insert all valid events in one DB call
        const result = await prisma.heatmapEvent.createMany({
            data: validEvents
        });

        return NextResponse.json({ ok: true, inserted: result.count }, { status: 200 });
    } catch (error) {
        console.error('Failed to track heatmap events:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
