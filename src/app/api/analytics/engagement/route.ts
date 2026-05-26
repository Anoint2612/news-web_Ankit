import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { articleEngagementSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = articleEngagementSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('ENGAGEMENT_VALIDATION_FAILED:', JSON.stringify(parsed.error.flatten()));
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { articleId, category, durationSeconds } = parsed.data;

    // Try to get session, but don't fail if unavailable
    // (sendBeacon requests may not carry session cookies in some contexts)
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      userId = session?.user?.id ?? null;
    } catch (sessionErr) {
      console.warn('ENGAGEMENT_SESSION_WARNING: Could not resolve session', sessionErr);
    }

    if (userId) {
      try {
        await prisma.articleEngagement.upsert({
          where: {
            userId_articleId: { userId, articleId },
          },
          create: {
            userId,
            articleId,
            category,
            timeSpentSeconds: durationSeconds,
          },
          update: {
            timeSpentSeconds: { increment: durationSeconds },
            category,
          },
        });
      } catch (upsertError: any) {
        if (upsertError.code === 'P2003') {
          console.warn(`ENGAGEMENT_USER_NOT_FOUND: userId ${userId} not in DB. Falling back to anonymous.`);
          await prisma.articleEngagement.create({
            data: {
              articleId,
              category,
              timeSpentSeconds: durationSeconds,
            },
          });
          userId = null;
        } else {
          throw upsertError;
        }
      }
    } else {
      // For anonymous users, always create a new record
      await prisma.articleEngagement.create({
        data: {
          articleId,
          category,
          timeSpentSeconds: durationSeconds,
        },
      });
    }

    console.log(`✅ ENGAGEMENT_RECORDED: article=${articleId}, user=${userId || 'anonymous'}, +${durationSeconds}s`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ARTICLE_ENGAGEMENT_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
