"use client";
import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  FileText,
  CalendarCheck,
  Megaphone,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  Navigation,
  Download,
  X,
  User,
  Plus,
  Bus,
  ShieldCheck,
  Calendar,
  Pin,
  Check,
  FileEdit,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCountryLabel } from "@/constants/countries";
import { fileDownloadUrl } from "@/components/FileUpload";
import { toast } from "sonner";
import { RichTextContent } from "@/screens/Announcements";

interface AnnouncementFormStatus {
  form_id: string;
  title?: string;
  is_active: boolean;
  is_closed: boolean;
  has_responded: boolean;
  closes_at?: string | null;
  question_count?: number;
}

interface Announcement {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category?: string;
  attachment_file_ids?: string[] | null;
  acknowledged_by?: string[];
  acknowledged_count?: number;
  has_acknowledged?: boolean;
  pinned: boolean;
  author_name: string;
  created_at: string;
  form_id?: string | null;
  form_status?: AnnouncementFormStatus | null;
}

interface DocumentUpdateItem {
  id: string;
  request_type: string;
  status: string;
  admin_note: string | null;
  result_file_id: string | null;
  dynamic_data: any;
  created_at: string;
  updated_at: string | null;
  is_unread?: boolean;
}

interface DashboardData {
  profile: {
    full_name: string;
    nationality: string;
    building: string;
    room_number: string;
    program: string;
    academic_year: string;
    passport_number: string;
    iqomah_number: string;
    iqomah_expiry: string;
    passport_file_id: string | null;
    iqomah_file_id: string | null;
  } | null;
  iqomah_days_left: number | null;
  complaints_open: number;
  complaints_total: number;
  documents_open: number;
  documents_total: number;
  permissions_total: number;
  active_permissions: {
    id: string;
    status: string;
    permission_type: string;
    destination: string;
    start_date: string;
    end_date: string;
    admin_note: string | null;
  }[];
  recent_announcements: Announcement[];
  document_updates?: DocumentUpdateItem[];
  documents_unread_count?: number;
}

export default function StudentDashboard() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [error, setError] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  // Dismissed document notification cards
  const [dismissedDocIds, setDismissedDocIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dismissed_doc_updates");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleDismiss = (docId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const updated = [...dismissedDocIds, docId];
    setDismissedDocIds(updated);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("dismissed_doc_updates", JSON.stringify(updated));
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    api
      .get("/dashboard/student")
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  }, []);

  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  const handleAcknowledge = async (id: string) => {
    setAcknowledgingId(id);
    try {
      await api.post(`/announcements/${id}/acknowledge`);
      toast.success(t("acknowledged_success"));
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          recent_announcements: prev.recent_announcements.map((a) =>
            a.id === id
              ? {
                  ...a,
                  has_acknowledged: true,
                  acknowledged_count: (a.acknowledged_count || 0) + 1,
                }
              : a
          ),
        };
      });
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Smart Filtering for Document Updates
  const filteredDocUpdates = useMemo(() => {
    if (!data?.document_updates) return [];
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    return data.document_updates.filter((doc) => {
      // 1. Exclude dismissed
      if (dismissedDocIds.includes(doc.id)) return false;

      const normStatus = (doc.status || "").toLowerCase();

      // 2. Never show cancelled in dashboard
      if (normStatus === "cancelled") return false;

      // 3. Active requests (pending or in_progress)
      if (normStatus === "pending" || normStatus === "in_progress") return true;

      // 4. Unread updates
      if (doc.is_unread) return true;

      // 5. Completed requests with result file within last 7 days
      if (normStatus === "completed" && doc.result_file_id) {
        const docTime = new Date(doc.updated_at || doc.created_at).getTime();
        if (docTime >= sevenDaysAgo) return true;
      }

      return false;
    });
  }, [data?.document_updates, dismissedDocIds]);

  // Hard limit: Show top 2 items only
  const visibleDocUpdates = filteredDocUpdates.slice(0, 2);
  const extraDocCount = filteredDocUpdates.length - visibleDocUpdates.length;

  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p>Unable to load the dashboard. Check that the demo server is running.</p>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  if (!data) return <div className="text-muted-foreground p-8 text-center">{t("loading")}</div>;

  const { profile } = data;
  const expSoon = data.iqomah_days_left != null && data.iqomah_days_left <= 30;
  const missingPassport = profile && !profile.passport_file_id;
  const missingIqomah = profile && !profile.iqomah_file_id;
  const docsIncomplete = missingPassport || missingIqomah;

  return (
    <div className="space-y-6" data-testid="student-dashboard">
      {/* ── 1. Welcome Header ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {t("hello")}, {(user || null)?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("tagline")}</p>
      </div>

      {/* ── 2. Alerts (Missing Docs & Expiration Warning) ─────── */}
      {docsIncomplete && (
        <div
          className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm"
          data-testid="docs-missing-alert"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-900">{t("docs_missing_alert")}</div>
            <div className="text-xs text-red-800 mt-0.5 flex flex-wrap gap-2">
              {missingPassport && (
                <span className="rounded-full bg-white/60 px-2 py-0.5">• {t("passport")}</span>
              )}
              {missingIqomah && (
                <span className="rounded-full bg-white/60 px-2 py-0.5">• {t("iqomah_number")}</span>
              )}
            </div>
          </div>
          <Link href="/profile">
            <Button
              size="sm"
              variant="outline"
              className="border-red-300 hover:bg-red-100 gap-1.5 h-8 text-xs font-medium"
              data-testid="upload-docs-cta"
            >
              <Upload className="h-3.5 w-3.5" /> {t("my_documents")}
            </Button>
          </Link>
        </div>
      )}

      {expSoon && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-amber-900">{t("warning_expiring")}</div>
            <div className="text-xs text-amber-800 mt-0.5 tabular-nums">
              {t("iqomah_expiry")}: {profile?.iqomah_expiry} · {data.iqomah_days_left} {t("days_left")}
            </div>
          </div>
        </div>
      )}

      {/* ── 3. 4 Main Stat Cards (Immediate Visibility) ──────── */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 sm:p-5 border-slate-200 shadow-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {t("my_iqomah")}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
            {data.iqomah_days_left ?? "—"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("days_left")}</div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200 shadow-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {t("complaints")}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
              {data.complaints_open}
            </div>
            <div className="text-xs text-muted-foreground">/ {data.complaints_total}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("open_requests")}</div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200 shadow-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {t("documents")}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <div className="text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
              {data.documents_open}
            </div>
            <div className="text-xs text-muted-foreground">/ {data.documents_total}</div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("open_requests")}</div>
        </Card>

        <Card className="p-4 sm:p-5 border-slate-200 shadow-sm">
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            {t("permissions")}
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold tabular-nums text-slate-900">
            {data.permissions_total}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t("all")}</div>
        </Card>
      </div>

      {/* ── 4. Balanced 2-Column Grid (LG screens) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── KOLOM 1: Document Updates & Active Permissions ──── */}
        <div className="space-y-6">
          {/* Document Updates from Staff/Admin (Max 2 cards) */}
          {visibleDocUpdates.length > 0 && (
            <div className="space-y-2.5" data-testid="document-updates-banner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>{t("document_updates_title")}</span>
                  {data.documents_unread_count ? (
                    <Badge className="bg-red-500 text-white hover:bg-red-500 text-[10px] px-1.5 py-0 h-4">
                      {data.documents_unread_count} {t("new_badge")}
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {extraDocCount > 0 && (
                    <span className="text-[11px] font-medium text-slate-600 bg-slate-100 rounded-full px-2 py-0.5 tabular-nums">
                      {lang === "ar" ? `+${extraDocCount} طلبات أخرى` : `+${extraDocCount} more`}
                    </span>
                  )}
                  <Link href="/documents">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                    >
                      {t("view_all_documents")} →
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-2.5">
                {visibleDocUpdates.map((doc) => {
                  const normStatus = (doc.status || "").toLowerCase();
                  let tone = {
                    bg: "bg-slate-50",
                    border: "border-slate-200",
                    text: "text-slate-900",
                    sub: "text-slate-700",
                    icon: Clock,
                    iconColor: "text-slate-500",
                    badgeClass: "bg-slate-100 text-slate-800",
                  };

                  if (normStatus === "completed") {
                    tone = {
                      bg: "bg-emerald-50/90",
                      border: "border-emerald-200",
                      text: "text-emerald-950",
                      sub: "text-emerald-800",
                      icon: CheckCircle2,
                      iconColor: "text-emerald-600",
                      badgeClass: "bg-emerald-100 text-emerald-800",
                    };
                  } else if (normStatus === "approved") {
                    tone = {
                      bg: "bg-blue-50/90",
                      border: "border-blue-200",
                      text: "text-blue-950",
                      sub: "text-blue-800",
                      icon: CheckCircle2,
                      iconColor: "text-blue-600",
                      badgeClass: "bg-blue-100 text-blue-800",
                    };
                  } else if (normStatus === "in_progress") {
                    tone = {
                      bg: "bg-sky-50/90",
                      border: "border-sky-200",
                      text: "text-sky-950",
                      sub: "text-sky-800",
                      icon: Clock,
                      iconColor: "text-sky-600",
                      badgeClass: "bg-sky-100 text-sky-800",
                    };
                  } else if (normStatus === "rejected") {
                    tone = {
                      bg: "bg-rose-50/90",
                      border: "border-rose-200",
                      text: "text-rose-950",
                      sub: "text-rose-800",
                      icon: XCircle,
                      iconColor: "text-rose-600",
                      badgeClass: "bg-rose-100 text-rose-800",
                    };
                  }

                  const Icon = tone.icon;
                  return (
                    <div
                      key={doc.id}
                      className={`relative flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border ${tone.border} ${tone.bg} p-3 sm:p-3.5 pe-9 shadow-sm transition-colors`}
                      data-testid={`doc-update-card-${doc.id}`}
                    >
                      {/* Dismiss / Mark Read Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDismiss(doc.id, e)}
                        className="absolute top-2.5 end-2.5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors"
                        title={t("dismiss")}
                        aria-label={t("dismiss")}
                        data-testid={`dismiss-doc-${doc.id}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className={`h-4 w-4 ${tone.iconColor} shrink-0 mt-0.5`} />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={`text-xs font-bold ${tone.text}`}>
                              {t(doc.request_type)}
                            </span>
                            <Badge className={`${tone.badgeClass} text-[9px] px-1.5 py-0 h-4`}>
                              {t(doc.status)}
                            </Badge>
                            {doc.is_unread && (
                              <span
                                className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"
                                title="Unread"
                              />
                            )}
                            <span className="text-[10px] text-muted-foreground tabular-nums">
                              {doc.updated_at
                                ? new Date(doc.updated_at).toLocaleDateString()
                                : ""}
                            </span>
                          </div>

                          <p className={`text-xs ${tone.sub} leading-relaxed line-clamp-2`}>
                            {normStatus === "completed" &&
                            doc.request_type === "letter_of_enrollment" &&
                            doc.result_file_id
                              ? lang === "ar"
                                ? "تم اعتماد الخطاب وتوقيعه. يمكنك تحميل النسخة الإلكترونية (PDF) الآن."
                                : "Your letter of enrollment has been finalized. Download PDF now."
                              : normStatus === "completed" &&
                                doc.request_type === "iqomah_renewal"
                              ? lang === "ar"
                                ? "تم استكمال تجديد الإقامة. يرجى تحديث بيانات الإقامة في ملفك الشخصي."
                                : "Iqomah renewal completed. Please update your profile."
                              : normStatus === "completed"
                              ? lang === "ar"
                                ? "تم استكمال معالجة طلبك بنجاح."
                                : "Your document request has been completed successfully."
                              : normStatus === "in_progress"
                              ? lang === "ar"
                                ? "طلبك قيد المعالجة من قبل إدارة السكن والجوازات."
                                : "Your document request is currently being processed."
                              : normStatus === "rejected"
                              ? lang === "ar"
                                ? "تم رفض الطلب من قبل الإدارة."
                                : "Your document request has been rejected."
                              : lang === "ar"
                              ? "تم تحديث حالة طلبك من قبل الإدارة."
                              : "Your document request has been updated."}
                          </p>

                          {doc.admin_note && (
                            <div className="mt-1 text-[11px] italic bg-white/70 rounded px-2 py-0.5 border border-black/5 text-slate-800 line-clamp-1">
                              <span className="font-semibold not-italic text-slate-600">
                                {t("admin_note")}:{" "}
                              </span>
                              &ldquo;{doc.admin_note}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        {normStatus === "completed" && doc.result_file_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="gap-1 h-7 text-xs bg-white text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 font-medium px-2.5 shadow-xs"
                          >
                            <a
                              href={fileDownloadUrl(doc.result_file_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download className="h-3 w-3 text-emerald-600" />
                              <span>{t("download_letter")}</span>
                            </a>
                          </Button>
                        )}
                        {normStatus === "completed" && doc.request_type === "iqomah_renewal" && (
                          <Link href="/profile">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs bg-white text-primary border-primary/30 px-2.5"
                            >
                              {t("update_profile_now")}
                            </Button>
                          </Link>
                        )}
                        <Link href="/documents">
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`${tone.text} hover:bg-white/60 h-7 text-xs px-2`}
                          >
                            {t("view")}
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active & Upcoming Permissions */}
          {data.active_permissions && data.active_permissions.length > 0 && (
            <div className="space-y-2.5" data-testid="active-permissions-banner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <CalendarCheck className="h-3.5 w-3.5 text-primary" />
                  <span>{t("my_permissions")}</span>
                </div>
                <Link href="/permissions">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                  >
                    {t("view_all_permissions")} →
                  </Button>
                </Link>
              </div>

              <div className="grid gap-2.5">
                {data.active_permissions.slice(0, 3).map((p) => {
                  const normStatus = (p.status || "").toUpperCase();
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const isOverdue =
                    normStatus === "ACTIVE" && (p.end_date || "").slice(0, 10) < todayStr;
                  let tone = {
                    bg: "bg-amber-50",
                    border: "border-amber-200",
                    text: "text-amber-900",
                    sub: "text-amber-800",
                    icon: Clock,
                    iconColor: "text-amber-600",
                    msg: t("permission_pending_msg"),
                  };

                  if (normStatus === "APPROVED") {
                    tone = {
                      bg: "bg-blue-50",
                      border: "border-blue-200",
                      text: "text-blue-900",
                      sub: "text-blue-800",
                      icon: CheckCircle2,
                      iconColor: "text-blue-600",
                      msg: t("permission_approved_msg"),
                    };
                  } else if (normStatus === "ACTIVE") {
                    if (isOverdue) {
                      tone = {
                        bg: "bg-rose-50",
                        border: "border-rose-300",
                        text: "text-rose-900",
                        sub: "text-rose-800",
                        icon: AlertTriangle,
                        iconColor: "text-rose-600",
                        msg: t("overstay_badge"),
                      };
                    } else {
                      tone = {
                        bg: "bg-emerald-50",
                        border: "border-emerald-200",
                        text: "text-emerald-900",
                        sub: "text-emerald-800",
                        icon: Navigation,
                        iconColor: "text-emerald-600",
                        msg: t("permission_active_msg"),
                      };
                    }
                  } else if (normStatus === "COMPLETED") {
                    tone = {
                      bg: "bg-slate-50",
                      border: "border-slate-200",
                      text: "text-slate-900",
                      sub: "text-slate-700",
                      icon: CheckCircle2,
                      iconColor: "text-slate-600",
                      msg: t("permission_completed_msg"),
                    };
                  } else if (normStatus === "CANCELLED") {
                    tone = {
                      bg: "bg-slate-50",
                      border: "border-slate-200",
                      text: "text-slate-700",
                      sub: "text-slate-600",
                      icon: XCircle,
                      iconColor: "text-slate-400",
                      msg: t("CANCELLED"),
                    };
                  } else if (normStatus === "REJECTED") {
                    tone = {
                      bg: "bg-red-50",
                      border: "border-red-200",
                      text: "text-red-900",
                      sub: "text-red-800",
                      icon: XCircle,
                      iconColor: "text-red-600",
                      msg: t("permission_rejected_msg"),
                    };
                  }

                  const Icon = tone.icon;
                  return (
                    <div
                      key={p.id}
                      className={`flex items-start justify-between gap-3 rounded-lg border ${tone.border} ${tone.bg} p-3 sm:p-3.5 shadow-sm`}
                      data-testid={`perm-banner-${p.id}`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className={`h-4 w-4 ${tone.iconColor} shrink-0 mt-0.5`} />
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className={`text-xs font-semibold ${tone.text} flex items-center gap-1.5 flex-wrap`}>
                            <span>{t(p.permission_type)}</span>
                            <span className="opacity-60">·</span>
                            <span className="font-normal">{p.destination}</span>
                            <span
                              className={`text-[9px] rounded-full bg-white/70 px-2 py-0.5 uppercase tracking-wide ${tone.text}`}
                            >
                              {tone.msg}
                            </span>
                          </div>
                          <div className={`text-[11px] ${tone.sub} tabular-nums`}>
                            {p.start_date} → {p.end_date}
                          </div>
                          {isOverdue && (
                            <div className="mt-1.5 text-xs font-medium text-rose-700 bg-rose-100/90 rounded px-2 py-1 flex items-center gap-1.5 border border-rose-200">
                              <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" />
                              <span>{t("late_return_dashboard_desc")}</span>
                            </div>
                          )}
                          {p.admin_note && (
                            <div className={`text-[11px] ${tone.sub} mt-1 italic line-clamp-1`}>
                              &ldquo;{p.admin_note}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <Link href="/permissions" className="shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`${tone.text} hover:bg-white/60 h-7 text-xs px-2`}
                        >
                          {t("view")}
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Friendly placeholder when Kolom 1 is completely clear */}
          {visibleDocUpdates.length === 0 &&
            (!data.active_permissions || data.active_permissions.length === 0) && (
              <Card className="p-6 border-slate-200 text-center space-y-3 shadow-sm bg-slate-50/50">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">
                    {lang === "ar"
                      ? "لا توجد طلبات معلقة أو أذونات نشطة"
                      : "No pending requests or active leaves"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === "ar"
                      ? "جميع معاملاتك ووثائقك محدثة بالكامل."
                      : "All your requests and document submissions are up to date."}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Link href="/documents">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      <Plus className="h-3 w-3" />
                      <span>{t("new_document_request")}</span>
                    </Button>
                  </Link>
                  <Link href="/permissions">
                    <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                      <Plus className="h-3 w-3" />
                      <span>{t("new_permission")}</span>
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
        </div>

        {/* ── KOLOM 2: Announcements & Profile Summary ────────── */}
        <div className="space-y-6">
          {/* Recent Announcements */}
          <Card className="p-5 sm:p-6 border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">
                  {t("recent_announcements")}
                </h3>
              </div>
              <Link href="/announcements">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                >
                  {lang === "ar" ? `← ${t("view_all_documents")}` : `${t("view_all_documents")} →`}
                </Button>
              </Link>
            </div>
            <div className="space-y-3">
              {data.recent_announcements.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">{t("no_data")}</div>
              )}
              {data.recent_announcements.slice(0, 3).map((a) => (
                <AnnouncementItem
                  key={a.id}
                  a={a}
                  onAcknowledge={handleAcknowledge}
                  isAcknowledging={acknowledgingId === a.id}
                />
              ))}
            </div>
          </Card>

          {/* Profile Summary Card */}
          {profile && (
            <Card className="p-5 sm:p-6 border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h3 className="text-base font-semibold text-slate-900">{t("profile")}</h3>
                </div>
                <Link href="/profile">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary/80 px-2"
                  >
                    {t("edit")} →
                  </Button>
                </Link>
              </div>
              <div className="space-y-2.5 text-xs sm:text-sm">
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
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-slate-800 text-end truncate max-w-[200px]">
        {value || "—"}
      </span>
    </div>
  );
}

function AnnouncementItem({
  a,
  onAcknowledge,
  isAcknowledging = false,
}: {
  a: Announcement;
  onAcknowledge?: (id: string) => void;
  isAcknowledging?: boolean;
}) {
  const { t, lang } = useI18n();
  const title = lang === "ar" ? a.title_ar : a.title_en;
  const body = lang === "ar" ? a.body_ar : a.body_en;
  const isUrgent = (a.category || "").toUpperCase() === "URGENT";

  const renderCategoryBadge = (category?: string) => {
    switch (category) {
      case "URGENT":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 gap-1 font-medium text-[10px] h-5"
          >
            <AlertTriangle className="h-2.5 w-2.5 text-red-600" />
            {t("cat_urgent")}
          </Badge>
        );
      case "TRANSPORT":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-800 border-amber-200 gap-1 font-medium text-[10px] h-5"
          >
            <Bus className="h-2.5 w-2.5 text-amber-600" />
            {t("cat_transport")}
          </Badge>
        );
      case "IMMIGRATION":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-medium text-[10px] h-5"
          >
            <ShieldCheck className="h-2.5 w-2.5 text-blue-600" />
            {t("cat_immigration")}
          </Badge>
        );
      case "EVENT":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 gap-1 font-medium text-[10px] h-5"
          >
            <Calendar className="h-2.5 w-2.5 text-purple-600" />
            {t("cat_event")}
          </Badge>
        );
      case "GENERAL":
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 border-slate-200 gap-1 font-medium text-[10px] h-5"
          >
            <Megaphone className="h-2.5 w-2.5 text-slate-500" />
            {t("cat_general")}
          </Badge>
        );
    }
  };

  return (
    <div
      className={`rounded-lg border p-3.5 transition-all shadow-xs ${
        isUrgent
          ? "border-red-300 bg-red-50/30 ring-1 ring-red-200/50"
          : a.pinned
          ? "border-primary/30 ring-1 ring-primary/20 bg-primary/[0.02]"
          : "border-slate-200 bg-white hover:border-primary/30"
      }`}
    >
      {/* Category, Pinned Badge, and Date */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {renderCategoryBadge(a.category)}
        {a.pinned && (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/15 gap-1 text-[10px] font-medium h-5">
            <Pin className="h-2.5 w-2.5" />
            {t("pinned")}
          </Badge>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums ms-auto">
          {new Date(a.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Title */}
      <div className="flex items-center gap-1.5 mt-2">
        {isUrgent && <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />}
        <h4
          className={`font-semibold text-xs sm:text-sm line-clamp-1 ${
            isUrgent ? "text-red-950 font-bold" : "text-slate-900"
          }`}
        >
          {title}
        </h4>
      </div>

      {/* Rich Text Body with line clamp */}
      <div className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        <RichTextContent text={body} />
      </div>

      {/* Smart Form Action Bar (if form_id) */}
      {a.form_id && (
        <div className="mt-2.5 p-2 rounded-md border border-slate-200/80 bg-slate-50/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <FileEdit className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-[11px] font-medium text-slate-800 truncate">
              {a.form_status?.title || t("forms")}
            </span>
          </div>
          <div className="shrink-0">
            {a.form_status?.has_responded ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 gap-1 text-[10px] font-medium h-6">
                <Check className="h-2.5 w-2.5" />
                {t("form_completed_badge")}
              </Badge>
            ) : a.form_status?.is_closed || !a.form_status?.is_active ? (
              <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-medium h-6">
                {t("form_closed_badge")}
              </Badge>
            ) : (
              <Link href={`/forms?formId=${a.form_id}`}>
                <Button size="sm" className="h-6 px-2 text-[10px] gap-1 shadow-xs font-medium">
                  <span>{t("fill_out_form")}</span>
                  <span>{lang === "ar" ? "←" : "→"}</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Footer: Author and Quick Acknowledge for Urgent */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-muted-foreground">
        <span className="truncate">— {a.author_name}</span>

        {isUrgent && (
          <div className="shrink-0">
            {a.has_acknowledged ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1 text-[10px] font-medium h-5">
                <Check className="h-2.5 w-2.5 text-emerald-700" />
                <span>{t("acknowledged_badge")}</span>
              </Badge>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAcknowledge?.(a.id)}
                disabled={isAcknowledging}
                className="h-6 px-2 text-[10px] gap-1 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-medium"
              >
                <CheckCircle2 className="h-3 w-3 text-amber-700" />
                <span>{t("acknowledge_btn")}</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
