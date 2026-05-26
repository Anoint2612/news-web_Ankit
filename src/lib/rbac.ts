import { NextResponse } from 'next/server';
import { getServerSession, Session } from 'next-auth';
import { UserRole } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { normalizeRole } from '@/lib/roles';

export type AuthorizedSession = Session & {
  user: Session['user'] & { id: string; role: UserRole };
};

/**
 * Returns the session if the authenticated user's role is in `roles`.
 * Otherwise returns a 403 Forbidden response (or 401 if unauthenticated).
 */
export async function authorizeRoles(
  ...roles: UserRole[]
): Promise<{ session: AuthorizedSession } | NextResponse> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userRole = normalizeRole((session.user as { role?: string }).role);

  if (!roles.includes(userRole)) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const authorized: AuthorizedSession = {
    ...session,
    user: {
      ...session.user,
      id: (session.user as { id?: string }).id ?? '',
      role: userRole,
    },
  };

  return { session: authorized };
}

export function isAuthorized(
  result: { session: AuthorizedSession } | NextResponse
): result is { session: AuthorizedSession } {
  return 'session' in result;
}
