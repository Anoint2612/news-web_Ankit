import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { analyzeUserSessionLogs } from '@/lib/geminiService';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        // Fetch the session and its heatmap events
        const session = await prisma.userSession.findUnique({
            where: { id: sessionId },
            include: {
                heatmapEvents: {
                    orderBy: { timestamp: 'asc' },
                    take: 500 // Limit to avoid hitting token limits on massive sessions
                }
            }
        });

        if (!session) {
            return NextResponse.json({ error: 'Session not found' }, { status: 404 });
        }

        // If a report already exists and it didn't fail previously, return it instead of regenerating
        if (session.aiReport && !session.aiReport.startsWith('Failed to') && !session.aiReport.includes('encountered an error')) {
            return NextResponse.json({ report: session.aiReport });
        }

        if (session.heatmapEvents.length === 0) {
            return NextResponse.json({ error: 'No tracking logs found for this session' }, { status: 400 });
        }

        // Generate the behavioral report via Gemini
        const report = await analyzeUserSessionLogs(session.heatmapEvents);

        // Save the generated report back to the database
        await prisma.userSession.update({
            where: { id: sessionId },
            data: {
                aiReport: report,
                reportedAt: new Date()
            }
        });

        return NextResponse.json({ report });
    } catch (error: any) {
        console.error('Failed to generate AI report:', error);
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
    }
}
