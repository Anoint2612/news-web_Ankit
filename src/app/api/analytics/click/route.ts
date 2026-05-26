import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { articleClickSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = articleClickSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid input', errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const { articleId, category, title } = parsed.data;

    await prisma.articleClick.create({
      data: {
        articleId,
        category,
        title: title || '',
        userId: session?.user?.id ?? null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ARTICLE_CLICK_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
