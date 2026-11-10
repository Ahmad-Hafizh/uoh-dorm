"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  type LucideIcon, LayoutDashboard, Users, MessageSquareWarning, FileText, Megaphone,
  CalendarCheck, UserCircle2, LogOut, Menu, X, Globe, ChevronRight, ShieldCheck, ClipboardList
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useNotifications } from "@/context/NotificationsContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function NavItem({ to, icon: Icon, label, testid, badge }: { to: string; icon: LucideIcon; label: string; testid: string; badge?: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isActive = to === "/" ? pathname === to : pathname === to || pathname.startsWith(to + "/");
  return (
    <Link
      href={to}
      data-testid={testid}
      className={
        `group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors min-w-0 ${
          isActive
            ? "bg-primary/10 text-primary font-semibold"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate flex-1 min-w-0">{label}</span>
      {badge}
      {!badge && <ChevronRight className="ms-auto h-3.5 w-3.5 opacity-0 group-hover:opacity-100 rtl-flip transition-opacity shrink-0" />}
    </Link>
  );
}

function NumberBadge({ count, testid }: { count?: number; testid: string }) {
  if (!count) return null;
  return (
    <span
      className="ms-auto grid min-w-[20px] h-5 px-1.5 place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white tabular-nums shrink-0"
      data-testid={testid}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarContent({ onNav, docsIncomplete, counts }: { onNav?: () => void; docsIncomplete?: boolean; counts?: { forms_unread: number; announcements_unread: number; permissions_updates?: number; permissions_pending?: number } }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isStaff = (user || null)?.role === "admin" || (user || null)?.role === "staff";
  const isAdmin = (user || null)?.role === "admin";
  return (
    <div className="flex h-full flex-col w-full min-w-0 overflow-hidden bg-white">
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-200 shrink-0">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold text-lg shrink-0">
          H
        </div>
        <div className="min-w-0 flex-1 pe-6">
          <div className="text-sm font-bold leading-tight truncate" title={t("app_full")}>{t("app_full")}</div>
          <div className="text-xs text-muted-foreground truncate" title={t("tagline")}>{t("tagline")}</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto min-h-0" onClick={onNav}>
        <NavItem to="/" icon={LayoutDashboard} label={t("dashboard")} testid="nav-dashboard" />
        {isStaff && <NavItem to="/students" icon={Users} label={t("students")} testid="nav-students" />}
        {isAdmin && <NavItem to="/staff" icon={ShieldCheck} label={t("staff_management")} testid="nav-staff" />}
        <NavItem to="/complaints" icon={MessageSquareWarning} label={t("complaints")} testid="nav-complaints" />
        <NavItem to="/documents" icon={FileText} label={t("documents")} testid="nav-documents" />
        <NavItem
          to="/forms" icon={ClipboardList} label={t("forms")} testid="nav-forms"
          badge={<NumberBadge count={counts?.forms_unread} testid="badge-forms" />}
        />
        <NavItem to="/permissions" icon={CalendarCheck} label={t("permissions")} testid="nav-permissions"
          badge={<NumberBadge
            count={(user || null)?.role === "student" ? counts?.permissions_updates : counts?.permissions_pending}
            testid="badge-permissions"
          />}
        />
        <NavItem
          to="/announcements" icon={Megaphone} label={t("announcements")} testid="nav-announcements"
          badge={<NumberBadge count={counts?.announcements_unread} testid="badge-announcements" />}
        />
        <NavItem
          to="/profile"
          icon={UserCircle2}
          label={t("profile")}
          testid="nav-profile"
          badge={docsIncomplete ? (
            <span
              className="ms-auto grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white text-[10px] font-bold ring-2 ring-white shrink-0"
              data-testid="profile-badge-missing"
              title="Missing documents"
            >!</span>
          ) : null}
        />
      </nav>
      <div className="p-4 border-t border-slate-200 text-[11px] text-muted-foreground shrink-0 bg-slate-50/50">
        <div className="truncate">© University of Hail · 2026</div>
      </div>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { counts } = useNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studentProfile, setStudentProfile] = useState<{ passport_file_id: string | null; iqomah_file_id: string | null } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if ((user || null)?.role === "student") {
      api.get("/students/me").then((r) => setStudentProfile(r.data)).catch(() => {});
    } else {
      setStudentProfile(null);
    }
  }, [user]);

  const docsIncomplete =
    (user || null)?.role === "student" &&
    studentProfile != null &&
    (!studentProfile.passport_file_id || !studentProfile.iqomah_file_id);

  const initials = ((user || null)?.name || "?")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-72 border-e border-slate-200 bg-white z-30 overflow-hidden">
        <SidebarContent docsIncomplete={docsIncomplete} counts={counts} />
      </aside>

      {/* Content wrapper */}
      <div className="lg:ps-72 min-h-screen flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            {/* mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden" data-testid="menu-toggle">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side={lang === "ar" ? "right" : "left"} className="w-72 p-0 overflow-hidden">
                <SheetTitle className="sr-only">{t("app_name")}</SheetTitle>
                <SidebarContent onNav={() => setMobileOpen(false)} docsIncomplete={docsIncomplete} counts={counts} />
              </SheetContent>
            </Sheet>

            <div className="ms-1 lg:ms-0">
              <div className="text-sm font-semibold">{t("app_name")}</div>
              <div className="text-[11px] text-muted-foreground -mt-0.5">
                {t("tagline")}
              </div>
            </div>

            <div className="ms-auto flex items-center gap-2">
              {/* Language switcher */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" data-testid="lang-switcher">
                    <Globe className="h-4 w-4" />
                    <span className="text-xs font-semibold">{lang.toUpperCase()}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLang("en")} data-testid="lang-en">English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLang("ar")} data-testid="lang-ar">العربية</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 h-9 px-2" data-testid="user-menu">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-start leading-tight">
                      <div className="text-xs font-semibold truncate max-w-[140px]">{(user || null)?.name}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{(user || null)?.role}</div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>{(user || null)?.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/profile")} data-testid="user-menu-profile">
                    <UserCircle2 className="me-2 h-4 w-4" /> {t("profile")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => { await logout(); router.push("/login"); }}
                    className="text-destructive focus:text-destructive"
                    data-testid="user-menu-logout"
                  >
                    <LogOut className="me-2 h-4 w-4" /> {t("sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
