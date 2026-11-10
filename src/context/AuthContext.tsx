"use client";
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode, type Dispatch, type SetStateAction } from "react";
import axios from "axios";
import { api, formatApiError } from "@/lib/api";

export interface AuthUser { id: string; email: string; name: string; role: "admin" | "staff" | "student" }
type UserState = AuthUser | false | null;
interface AuthContextValue {
  user: UserState;
  setUser: Dispatch<SetStateAction<UserState>>;
  login(email: string, password: string): Promise<{ ok: boolean; error?: string }>;
  logout(): Promise<void>;
  reload(): Promise<void>;
}
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserState>(null);
  const loadMe = useCallback(async () => {
    try { const { data } = await api.get<AuthUser>("/auth/me"); setUser(data); }
    catch { setUser(false); }
  }, []);
  useEffect(() => { void loadMe(); }, [loadMe]);
  const login = async (email: string, password: string) => {
    try {
      const { data } = await api.post<{ user: AuthUser }>("/auth/login", { email, password });
      setUser(data.user);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: axios.isAxiosError(error) ? formatApiError(error.response?.data?.detail) : error instanceof Error ? error.message : "Something went wrong." };
    }
  };
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* Clear local session even if logout fails. */ }
    setUser(false);
  };
  return <AuthContext.Provider value={{ user, setUser, login, logout, reload: loadMe }}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
