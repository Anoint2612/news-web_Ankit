import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { adminSourceSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const sources = await prisma.newsSource.findMany({
            orderBy: [{ country: 'asc' }, { category: 'asc' }]
        });

        const analytics = await prisma.analytics.findMany({
            orderBy: { views: 'desc' }
        });

        const usersCount = await prisma.user.count();
        const articlesCount = await prisma.article.count();
        const commentsCount = await prisma.comment.count();
        const subscribersCount = await prisma.newsletter.count();
        const newsletter = await prisma.newsletter.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({
            sources,
            analytics,
            newsletter,
            stats: {
                users: usersCount,
                articles: articlesCount,
                comments: commentsCount,
                subscribers: subscribersCount
            }
        });
    } catch (error) {
        console.error('ADMIN_GET_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const ip = getClientIp(req);
        const rate = isRateLimited(`admin-sources-post:${ip}`, 20, 10 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many write operations. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = adminSourceSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }

        const { id, country, name, category, url, active } = parsed.data;

        if (id) {
            const updated = await prisma.newsSource.update({
                where: { id },
                data: { country, name, category, url, active }
            });
            return NextResponse.json(updated);
        } else {
            const created = await prisma.newsSource.create({
                data: { country, name, category, url, active }
            });
            return NextResponse.json(created);
        }
    } catch (error) {
        console.error('ADMIN_POST_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || (session.user as any).role !== 'ADMIN') {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const ip = getClientIp(req);
        const rate = isRateLimited(`admin-sources-delete:${ip}`, 20, 10 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many delete operations. Try again later.' }, { status: 429 });
        }

        const { id } = await req.json();
        if (!id || typeof id !== 'string') {
            return NextResponse.json({ message: 'Invalid source id' }, { status: 400 });
        }

        await prisma.newsSource.delete({
            where: { id }
        });

        return NextResponse.json({ message: 'Deleted successfully' });
    } catch (error) {
        console.error('ADMIN_DELETE_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
