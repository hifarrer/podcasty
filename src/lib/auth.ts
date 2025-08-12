import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  // Ensure a stable secret so JWT encryption/decryption works across reloads
  // Prefer NEXTAUTH_SECRET, then AUTH_SECRET, and finally a dev fallback
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-nextauth-secret-change-me",
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      allowDangerousEmailAccountLinking: true,
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Only allow Google sign-ins for verified emails
      if (account?.provider === "google") {
        const emailVerified = (profile as any)?.email_verified ?? (profile as any)?.verified_email;
        const email = (profile as any)?.email;
        if (!email || emailVerified === false) {
          return false;
        }
        // Default NextAuth + PrismaAdapter will link Google to an existing user with the same verified email.
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // fetch admin flag
        try {
          const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { isAdmin: true } });
          token.isAdmin = dbUser?.isAdmin || false;
        } catch {
          token.isAdmin = false;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = Boolean((token as any).isAdmin);
      }
      return session;
    }
  }
};






