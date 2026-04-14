import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/mail';
import { forgotPasswordSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        const rate = isRateLimited(`forgot-password:${ip}`, 5, 15 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many requests. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = forgotPasswordSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }

        const { email } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Return success anyway to prevent email enumeration
            return NextResponse.json({ message: 'If an account exists, code sent' }, { status: 200 });
        }

        const otp = randomInt(100000, 1000000).toString();
        const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.user.update({
            where: { email },
            data: {
                resetOTP: otp,
                resetOTPExpires: otpExpires,
            },
        });

        await sendPasswordResetEmail(email, otp);

        return NextResponse.json({ message: 'OTP sent' }, { status: 200 });
    } catch (error) {
        console.error('FORGOT_PASSWORD_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
