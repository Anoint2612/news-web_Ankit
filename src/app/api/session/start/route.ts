import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const session = await prisma.userSession.create({
            data: {
                userId,
                startedAt: new Date(),
            },
        });

        return NextResponse.json({ sessionId: session.id }, { status: 201 });
    } catch (error) {
        console.error('Failed to start session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
