"use client";
import { createContext, useContext, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { authClient, useSession, signIn, signOut } from "@/lib/auth-client";
import type { SessionUser } from "@/lib/auth-client";

export interface AuthUser { id: string; email: string; name: string; role: "admin" | "staff" | "student" }
type UserState = AuthUser | false | null;
interface AuthContextValue {
  user: UserState;
  setUser: (u: UserState) => void;
  login(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
  logout(): Promise<void>;
  reload(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * AuthProvider — wraps BetterAuth's useSession() so that every screen
 * can keep calling useAuth() with the same interface as before.
 *
 * Role is lowercased (DB stores "ADMIN" → client gets "admin") so the
 * eight existing screen components continue working without changes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = useSession();

  // Map BetterAuth session → legacy AuthUser format
  const user: UserState = useMemo(() => {
    if (isPending) return null;                // still loading
    if (!session?.user) return false;          // not authenticated
    const u = session.user as SessionUser;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: ((u.role || "STUDENT").toLowerCase()) as AuthUser["role"],
    };
  }, [session, isPending]);

  // Sinkronisasi Cookie secara resmi di Browser
  useEffect(() => {
    if (session?.user) {
      // Ambil kata depan email (misal: "admin@uoh.edu.sa" -> "admin")
      const prefix = session.user.email.split("@")[0];
      // Tanamkan cookie demo_user agar terbaca oleh demoHandler Next.js
      document.cookie = `demo_user=${prefix}; path=/`;
    } else if (!isPending && !session?.user) {
      // Bersihkan cookie saat logout
      document.cookie = "demo_user=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  }, [session, isPending]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        return { ok: false, error: result.error.message ?? "Invalid credentials" };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut();
  }, []);

  const reload = useCallback(async () => {
    // Ask BetterAuth client to re-fetch the session from the server.
    // useSession() is subscribed to the internal session store, so it
    // will automatically re-render with the fresh data.
    try { await authClient.getSession(); } catch { /* silent */ }
  }, []);

  // No-op: session state is managed entirely by BetterAuth.
  // Kept for interface compatibility with screens that destructure setUser.
  const setUser = useCallback(() => { }, []);

  const value = useMemo(
    () => ({ user, setUser, login, logout, reload }),
    [user, setUser, login, logout, reload],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
