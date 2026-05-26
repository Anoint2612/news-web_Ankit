import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const contentType = req.headers.get('content-type') || '';
        let body;
        
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

        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
        }

        const session = await prisma.userSession.findUnique({
            where: { id: sessionId }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        const endedAt = new Date();
        const totalDuration = Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000);

        await prisma.userSession.update({
            where: { id: sessionId },
            data: {
                endedAt,
                totalDuration
            }
        });

        return NextResponse.json({ ok: true }, { status: 200 });
    } catch (error) {
        console.error('Failed to end session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
