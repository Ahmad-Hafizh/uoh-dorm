"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MessageSquareWarning, FileText, CalendarCheck, Megaphone, Upload, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCountryLabel } from "@/constants/countries";

interface Announcement { id: string; title_en: string; title_ar: string; body_en: string; body_ar: string; pinned: boolean; author_name: string; created_at: string }
interface DashboardData { profile: { full_name: string; nationality: string; building: string; room_number: string; program: string; academic_year: string; passport_number: string; iqomah_number: string; iqomah_expiry: string; passport_file_id: string | null; iqomah_file_id: string | null } | null; iqomah_days_left: number | null; complaints_open: number; complaints_total: number; documents_open: number; documents_total: number; permissions_total: number; active_permissions: { id: string; status: string; permission_type: string; destination: string; start_date: string; end_date: string; admin_note: string | null }[]; recent_announcements: Announcement[] }
export default function StudentDashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [error, setError] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get("/dashboard/student").then((r) => setData(r.data)).catch(() => setError(true));
  }, []);

  if (error) return <div role="alert" className="space-y-3"><p>Unable to load the dashboard. Check that the demo server is running.</p><Button onClick={() => window.location.reload()}>Retry</Button></div>;
  if (!data) return <div className="text-muted-foreground">Loading…</div>;
  const { profile } = data;
  const expSoon = data.iqomah_days_left != null && data.iqomah_days_left <= 30;
  const missingPassport = profile && !profile.passport_file_id;
  const missingIqomah = profile && !profile.iqomah_file_id;
  const docsIncomplete = missingPassport || missingIqomah;

  return (
    <div className="space-y-6" data-testid="student-dashboard">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t("hello")}, {(user || null)?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("tagline")}</p>
      </div>

      {docsIncomplete && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4" data-testid="docs-missing-alert">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-900">{t("docs_missing_alert")}</div>
            <div className="text-xs text-red-800 mt-0.5 flex flex-wrap gap-2">
              {missingPassport && <span className="rounded-full bg-white/60 px-2 py-0.5">• {t("passport")}</span>}
              {missingIqomah && <span className="rounded-full bg-white/60 px-2 py-0.5">• {t("iqomah_number")}</span>}
            </div>
          </div>
          <Link href="/profile">
            <Button size="sm" variant="outline" className="border-red-300 hover:bg-red-100 gap-1.5" data-testid="upload-docs-cta">
              <Upload className="h-3.5 w-3.5" /> {t("my_documents")}
            </Button>
          </Link>
        </div>
      )}

      {expSoon && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">{t("warning_expiring")}</div>
            <div className="text-xs text-amber-800 mt-0.5">
              {t("iqomah_expiry")}: {profile?.iqomah_expiry} · {data.iqomah_days_left} {t("days_left")}
            </div>
          </div>
        </div>
      )}

      {data.active_permissions && data.active_permissions.length > 0 && (
        <div className="space-y-2" data-testid="active-permissions-banner">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <CalendarCheck className="h-3.5 w-3.5" /> {t("my_permissions")}
          </div>
          {data.active_permissions.map((p) => {
            const tone = p.status === "pending"
              ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-900", sub: "text-amber-800", icon: Clock, iconColor: "text-amber-600", msg: t("permission_pending_msg") }
              : p.status === "approved"
              ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", sub: "text-emerald-800", icon: CheckCircle2, iconColor: "text-emerald-600", msg: t("permission_approved_msg") }
              : { bg: "bg-red-50", border: "border-red-200", text: "text-red-900", sub: "text-red-800", icon: XCircle, iconColor: "text-red-600", msg: t("permission_rejected_msg") };
            const Icon = tone.icon;
            return (
              <div
                key={p.id}
                className={`flex items-start gap-3 rounded-lg border ${tone.border} ${tone.bg} p-4`}
                data-testid={`perm-banner-${p.id}`}
              >
                <Icon className={`h-5 w-5 ${tone.iconColor} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-semibold ${tone.text} flex items-center gap-2 flex-wrap`}>
                    <span>{t(p.permission_type)}</span>
                    <span className="opacity-60">·</span>
                    <span className="font-normal">{p.destination}</span>
                    <span className={`text-[10px] rounded-full bg-white/60 px-2 py-0.5 uppercase tracking-wide ${tone.text}`}>
                      {tone.msg}
                    </span>
                  </div>
                  <div className={`text-xs ${tone.sub} mt-1 tabular-nums`}>
                    {p.start_date} → {p.end_date}
                  </div>
                  {p.admin_note && (
                    <div className={`text-xs ${tone.sub} mt-1.5 italic`}>
                      &ldquo;{p.admin_note}&rdquo;
                    </div>
                  )}
                </div>
                <Link href="/permissions">
                  <Button size="sm" variant="ghost" className={`${tone.text} hover:bg-white/60`}>
                    {t("view")}
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5 border-slate-200">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("my_iqomah")}</div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
            {data.iqomah_days_left ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("days_left")}</div>
        </Card>
        <Card className="p-5 border-slate-200">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("complaints")}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-bold tabular-nums text-slate-900">{data.complaints_open}</div>
            <div className="text-xs text-muted-foreground">/ {data.complaints_total}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("open_requests")}</div>
        </Card>
        <Card className="p-5 border-slate-200">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("documents")}</div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-3xl font-bold tabular-nums text-slate-900">{data.documents_open}</div>
            <div className="text-xs text-muted-foreground">/ {data.documents_total}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("open_requests")}</div>
        </Card>
        <Card className="p-5 border-slate-200">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{t("permissions")}</div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{data.permissions_total}</div>
          <div className="mt-1 text-xs text-muted-foreground">{t("all")}</div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {profile && (
          <Card className="p-6 border-slate-200 lg:col-span-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">{t("profile")}</div>
            <div className="space-y-3 text-sm">
              <Row label={t("full_name")} value={profile.full_name} />
              <Row label={t("nationality")} value={getCountryLabel(profile.nationality, lang)} />
              <Row label={t("building")} value={profile.building} />
              <Row label={t("room")} value={profile.room_number} />
              <Row label={t("program")} value={profile.program} />
              <Row label={t("academic_year")} value={profile.academic_year} />
              <Row label={t("passport")} value={profile.passport_number} />
              <Row label={t("iqomah_number")} value={profile.iqomah_number} />
            </div>
          </Card>
        )}

        <Card className="p-6 border-slate-200 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone className="h-4 w-4 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900">{t("recent_announcements")}</h3>
          </div>
          <div className="space-y-4">
            {data.recent_announcements.length === 0 && (
              <div className="text-sm text-muted-foreground">{t("no_data")}</div>
            )}
            {data.recent_announcements.map((a) => (
              <AnnouncementItem key={a.id} a={a} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-slate-800 text-end">{value || "—"}</span>
    </div>
  );
}

function AnnouncementItem({ a }: { a: Announcement }) {
  const { lang } = useI18n();
  const title = lang === "ar" ? a.title_ar : a.title_en;
  const body = lang === "ar" ? a.body_ar : a.body_en;
  return (
    <div className="rounded-md border border-slate-200 p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-2">
        {a.pinned && <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]">PIN</Badge>}
        <h4 className="font-semibold text-slate-900">{title}</h4>
      </div>
      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{body}</p>
      <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">
        {a.author_name} · {new Date(a.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}
