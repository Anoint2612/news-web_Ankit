import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { resetPasswordSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        const rate = isRateLimited(`reset-password:${ip}`, 5, 15 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many reset attempts. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = resetPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }

        const { email, password } = parsed.data;

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                resetOTP: null,
                resetOTPExpires: null,
            },
        });

        return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
    } catch (error) {
        console.error('RESET_PASSWORD_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
