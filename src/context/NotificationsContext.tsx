"use client";
import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
interface Counts { forms_unread: number; announcements_unread: number; permissions_pending?: number; permissions_updates?: number }
interface NotificationsValue { counts: Counts; refresh(): Promise<void>; markRead(resource: "announcements" | "permissions"): Promise<void> }
const NotificationsContext = createContext<NotificationsValue | null>(null);
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ forms_unread: 0, announcements_unread: 0 });
  const refresh = useCallback(async () => {
    if (!user) { setCounts({ forms_unread: 0, announcements_unread: 0 }); return; }
    try { const { data } = await api.get<Counts>("/notifications/counts"); setCounts(data); } catch { /* Keep previous counts. */ }
  }, [user]);
  useEffect(() => { void refresh(); }, [refresh]);
  const markRead = useCallback(async (resource: "announcements" | "permissions") => {
    try { await api.post("/notifications/mark-read", { resource }); await refresh(); } catch { /* Keep previous counts. */ }
  }, [refresh]);
  const value = useMemo(() => ({ counts, refresh, markRead }), [counts, refresh, markRead]);
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
export function useNotifications(): NotificationsValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
