import { auth } from "@/lib/auth";
import { demoHandler } from "@/lib/demo/service";

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

  // ── 2. Data paths → demo handler with session bridge ──────────────
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (session?.user) {
      // The demo store uses the email-prefix as user id
      // ("admin@uoh.edu.sa" → id "admin").
      const emailPrefix = session.user.email.split("@")[0];

      // Build a cloned request whose cookie header carries the demo id.
      const bridgedHeaders = new Headers(request.headers);
      bridgedHeaders.set("cookie", `demo_user=${emailPrefix}`);

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
