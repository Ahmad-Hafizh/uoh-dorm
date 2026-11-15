import { auth } from "@/lib/auth";
import { demoHandler } from "@/lib/demo/service";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Temporary Dual-Write Account Sync:
 * Synchronize newly created student or staff credentials into Neon DB
 * so that new users can log in via Better Auth (/api/auth/sign-in/email).
 */
async function syncAccountToNeon(request: Request, pathname: string): Promise<void> {
  try {
    const clonedReq = request.clone();
    const body = await clonedReq.json();

    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.full_name || body.name || email?.split("@")[0] || "User";

    const isStudentCreation = pathname === "/api/students";
    const role = isStudentCreation
      ? "STUDENT"
      : (body.role || "STAFF").toUpperCase();

    if (email && password) {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(password, 10);
        const now = new Date();

        const newUser = await prisma.user.create({
          data: {
            email,
            name,
            emailVerified: true,
            role,
            createdAt: now,
            updatedAt: now,
          },
        });

        await prisma.account.create({
          data: {
            userId: newUser.id,
            accountId: newUser.id, // MUST match newUser.id, never email
            providerId: "credential",
            password: passwordHash,
            createdAt: now,
            updatedAt: now,
          },
        });
      }
    }
  } catch (error) {
    console.warn("[Dual-Write Account Sync Warning]:", error);
  }
}

/**
 * Unified API catch-all handler.
 *
 * • /api/auth/*  →  BetterAuth  (login, session, sign-out …)
 * • everything else  →  demo JSON handler, with the BetterAuth session
 *   bridged to a `demo_user` cookie so the demo dispatcher recognises
 *   the current user.
 */
async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // ── 1. Auth paths → BetterAuth ────────────────────────────────────
  if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
    return auth.handler(request);
  }

  // ── Temporary Dual-Write Account Sync ──────────────────────────────
  // Intercept POST /api/students and POST /api/staff to sync account to Neon DB
  const normalizedPath = url.pathname.replace(/\/$/, "");
  if (
    request.method === "POST" &&
    (normalizedPath === "/api/students" || normalizedPath === "/api/staff")
  ) {
    await syncAccountToNeon(request, normalizedPath);
  }

  // ── 2. Data paths → demo handler with session bridge ──────────────
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user) {
      // Build a cloned request whose cookie header carries the user's full email.
      // The demo store matches user case-insensitively by id, full email, or email prefix.
      const bridgedHeaders = new Headers(request.headers);
      bridgedHeaders.set("cookie", `demo_user=${session.user.email}`);

      return demoHandler(new Request(request, { headers: bridgedHeaders }));
    }
  } catch {
    // Session lookup failed — fall through to unauthenticated path.
  }

  // ── 3. No valid session → demo handler will return 401 ────────────
  return demoHandler(request);
}

export {
  handler as GET,
  handler as POST,
  handler as PATCH,
  handler as PUT,
  handler as DELETE,
};
