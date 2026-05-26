import { NextAuthOptions } from "next-auth"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { UserRole } from "@prisma/client"
import { ROLE_USER } from "@/lib/roles"

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma),
    session: {
        strategy: "jwt",
    },
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                console.log(`[NextAuth] Authorize callback triggered for email: ${credentials?.email}`);
                if (!credentials?.email || !credentials?.password) {
                    console.log("[NextAuth] Error: Missing email or password in credentials");
                    throw new Error("Invalid credentials");
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email }
                })

                if (!user) {
                    console.log(`[NextAuth] Error: No user found for email: ${credentials.email}`);
                    throw new Error("No user found");
                }

                if (!user.password) {
                    console.log(`[NextAuth] Error: User has no password set (possibly registered via OAuth)`);
                    throw new Error("No user found");
                }

                const isPasswordValid = await compare(credentials.password, user.password)
                console.log(`[NextAuth] Password verification result: ${isPasswordValid}`);

                if (!isPasswordValid) {
                    console.log("[NextAuth] Error: Password comparison failed");
                    throw new Error("Invalid password");
                }

                console.log(`[NextAuth] Email verification status: ${user.emailVerified}`);
                if (!user.emailVerified) {
                    console.log("[NextAuth] Error: User email is not verified");
                    throw new Error("Email not verified");
                }

                console.log(`[NextAuth] Authorization successful for: ${user.email} (Role: ${user.role})`);
                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    image: user.image,
                    role: user.role,
                }
            }
        })
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id;
                session.user.role = (token.role as UserRole) ?? ROLE_USER;
                session.user.name = (token.name as string) || session.user.name;
                session.user.image = (token.image as string) || session.user.image;
                session.user.email = (token.email as string) || session.user.email;
            }
            return session
        },
        async jwt({ token, user, trigger, session }) {
            if (user) {
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true },
                });
                token.id = user.id;
                token.role = dbUser?.role ?? ROLE_USER;
                token.name = user.name;
                token.image = user.image;
                token.email = user.email;
            }

            if (trigger === "update") {
                if (session?.name !== undefined) token.name = session.name;
                if (session && "image" in session) token.image = session.image as string | null | undefined;
            }

            return token;
        }
    },
    pages: {
        signIn: '/login',
        error: '/login',
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
}

