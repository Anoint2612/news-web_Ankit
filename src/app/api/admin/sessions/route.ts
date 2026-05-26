import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorizeRoles, isAuthorized } from '@/lib/rbac';

export async function GET() {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  try {
    const sessions = await prisma.sessionRecording.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { email: true, name: true },
        },
      },
      take: 100, // Reasonable limit
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('ADMIN_SESSIONS_ERROR:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
