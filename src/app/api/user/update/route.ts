import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function normalizeImageUrl(rawUrl: string | null | undefined) {
    if (!rawUrl) return undefined;
    const trimmed = rawUrl.trim();
    if (!trimmed) return undefined;

    const unsplashUrlMatch = trimmed.match(/^https?:\/\/(?:www\.)?unsplash\.com\/photos\/([^/?#]+)\/?(?:\?.*)?$/i);
    if (unsplashUrlMatch?.[1]) {
        const photoSegment = unsplashUrlMatch[1];
        const photoId = photoSegment.includes('-')
            ? photoSegment.split('-').pop()
            : photoSegment;

        if (photoId) {
            return `https://unsplash.com/photos/${photoId}/download?force=true&w=400`;
        }
    }

    return trimmed;
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !session.user?.email) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const { name, image } = await req.json();

        const normalizedImage = normalizeImageUrl(image);

        const updatedUser = await prisma.user.update({
            where: { email: session.user.email },
            data: {
                name: name?.trim() || undefined,
                image: normalizedImage,
            },
        });

        return NextResponse.json({
            message: 'Profile updated successfully',
            user: {
                name: updatedUser.name,
                image: updatedUser.image
            }
        }, { status: 200 });
    } catch (error) {
        console.error('UPDATE_PROFILE_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
