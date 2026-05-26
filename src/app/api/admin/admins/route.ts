import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { authorizeRoles, isAuthorized } from '@/lib/rbac';
import { createAdminSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
export async function GET() {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  const admins = await prisma.user.findMany({
    where: { role: UserRole.admin },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerified: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ admins });
}

export async function POST(req: Request) {
  const auth = await authorizeRoles(UserRole.admin);
  if (!isAuthorized(auth)) return auth;

  const ip = getClientIp(req);
  const rate = isRateLimited(`admin-create:${ip}`, 10, 15 * 60 * 1000);
  if (rate.limited) {
    return NextResponse.json({ message: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = createAdminSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Invalid input', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  const hashedPassword = await bcrypt.hash(password, 12);

  if (existing) {
    if (existing.role === UserRole.admin) {
      return NextResponse.json({ message: 'User is already an admin' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: UserRole.admin,
        password: hashedPassword,
        name: name ?? existing.name,
        emailVerified: existing.emailVerified ?? new Date(),
        resetOTP: null,
        resetOTPExpires: null,
      },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    return NextResponse.json({ admin: updated, promoted: true }, { status: 200 });
  }

  const admin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: UserRole.admin,
      emailVerified: new Date(),
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return NextResponse.json({ admin, promoted: false }, { status: 201 });
}
