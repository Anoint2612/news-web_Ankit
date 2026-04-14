import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import { verifyOtpSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        const rate = isRateLimited(`verify-otp:${ip}`, 10, 15 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many verification attempts. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = verifyOtpSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }

        const { email, otp } = parsed.data;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user || user.resetOTP !== otp) {
            return NextResponse.json({ message: 'Invalid OTP' }, { status: 400 });
        }

        if (user.resetOTPExpires && user.resetOTPExpires < new Date()) {
            return NextResponse.json({ message: 'OTP expired' }, { status: 400 });
        }

        // Verify user and clear OTP
        await prisma.user.update({
            where: { email },
            data: {
                emailVerified: new Date(),
                resetOTP: null,
                resetOTPExpires: null,
            },
        });

        return NextResponse.json({ message: 'Email verified successfully' }, { status: 200 });
    } catch (error) {
        console.error('VERIFY_OTP_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
