"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { I18nProvider } from "@/context/I18nContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
export default function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 60000, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><I18nProvider><AuthProvider><NotificationsProvider>{children}<Toaster position="top-center" richColors closeButton /></NotificationsProvider></AuthProvider></I18nProvider></QueryClientProvider>;
}
