import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendOTPEmail } from '@/lib/mail';
import { signupSchema } from '@/lib/validation';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export async function POST(req: Request) {
    try {
        const ip = getClientIp(req);
        const rate = isRateLimited(`signup:${ip}`, 8, 15 * 60 * 1000);
        if (rate.limited) {
            return NextResponse.json({ message: 'Too many signup attempts. Try again later.' }, { status: 429 });
        }

        const body = await req.json();
        const parsed = signupSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ message: 'Invalid input', errors: parsed.error.flatten() }, { status: 400 });
        }

        const { email, password } = parsed.data;

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        const hashedPassword = await bcrypt.hash(password, 12);
        const otp = randomInt(100000, 1000000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        if (existingUser) {
            // If user exists and is verified, then block re-registration
            if (existingUser.emailVerified) {
                return NextResponse.json({ message: 'User already exists' }, { status: 400 });
            }

            // If user exists but NOT verified, update their info and send new OTP
            await prisma.user.update({
                where: { email },
                data: {
                    password: hashedPassword,
                    resetOTP: otp,
                    resetOTPExpires: otpExpires,
                },
            });

            await sendOTPEmail(email, otp);

            return NextResponse.json({ message: 'Verification code resent' }, { status: 200 });
        }

        await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                resetOTP: otp,
                resetOTPExpires: otpExpires,
            },
        });

        await sendOTPEmail(email, otp);

        return NextResponse.json({ message: 'User created' }, { status: 201 });
    } catch (error) {
        console.error('SIGNUP_ERROR:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
