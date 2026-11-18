"use client";

import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { api, formatApiError } from "@/lib/api";

import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Plus,
  FileText,
  Paperclip,
  Eye,
  Printer,
  Plane,
  AlertCircle,
  Calendar,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  User,
  CreditCard,
  Building,
  CheckCircle2,
  Lock,
  Unlock,
  Search,
  Sliders,
  X,
  Pencil,
  XCircle,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import FileUpload, { fileDownloadUrl } from "@/components/FileUpload";
import { FileViewButton } from "@/components/FilePreview";
import { AirportCombobox } from "@/components/AirportCombobox";
import { DatePicker, DateRangePicker } from "@/components/ui/date-picker";
import { NewDocumentRequest } from "@/components/NewDocumentRequest";
import { EditDocumentRequest } from "@/components/EditDocumentRequest";
import { useNotifications } from "@/context/NotificationsContext";

const ALL_TYPES = [
  "iqomah_renewal",
  "return_ticket",
  "letter_of_enrollment",
  "exit_reentry_visa",
  "update_passport",
  "other",
];

const STATUSES = ["pending", "in_progress", "approved", "rejected", "completed", "cancelled"];

interface DynamicData {
  origin?: string;
  destination?: string;
  trip_type?: "one_way" | "round_trip" | string;
  departure_date?: string;
  return_date?: string | null;
  // Update passport fields
  new_passport_number?: string;
  date_of_issue?: string;
  date_of_expiry?: string;
  issuing_office?: string;
  passport_file?: string | null;
  passport_file_id?: string | null;
  // Exit/re-entry visa fields
  visa_validity_type?: "return_before" | "duration_days" | string;
  return_to_ksa_before?: string | null;
  duration_days?: number | string | null;
  resident_id_expiry?: string | null;
  [key: string]: any;
}

interface DocumentRequest {
  id: string;
  user_id: string;
  user_name: string;
  created_at: string;
  request_type: string;
  notes: string;
  attachment_file_ids: string[];
  status: string;
  admin_note: string;
  dynamic_data?: DynamicData | null;
  result_file_id?: string | null;
}

interface StudentProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  arabicName?: string;
  englishName?: string;
  universityId?: string;
  university_id?: string;
  nationality?: string;
  phone?: string;
  programStudy?: string;
  program_study?: string;
  roomNumber?: string;
  room_number?: string;
  passportNumber?: string;
  passport_number?: string;
  passportExpiry?: string;
  passport_expiry?: string;
  passportIssueDate?: string;
  passport_issue_date?: string;
  passportIssuingOffice?: string;
  passport_issuing_office?: string;
  residencyNumber?: string;
  residency_number?: string;
  residencyExpiry?: string;
  residency_expiry?: string;
  residencyType?: "IQOMAH" | "STUDENT_VISA" | string;
  residency_type?: "IQOMAH" | "STUDENT_VISA" | string;
  passport_file_id?: string | null;
  residency_file_id?: string | null;
  iqomah_file_id?: string | null;
}

interface SystemSettingData {
  id?: string;
  is_ticket_window_open: boolean;
  print_letterhead_url?: string | null;
  print_logo_url?: string | null;
  print_header_title_ar?: string | null;
  print_header_subtitle_ar?: string | null;
  print_header_title_en?: string | null;
  print_header_subtitle_en?: string | null;
  print_layout_style?: "standard" | "custom_image" | string;
  print_signature_name?: string | null;
  print_footer_text?: string | null;
  updated_at?: string;
}

interface FormDataValues {
  request_type: string;
  notes: string;
  attachment_file_ids: string[];
  // Dynamic fields for return_ticket
  origin: string;
  destination: string;
  trip_type: "one_way" | "round_trip";
  departure_date: string;
  return_date: string;
  // Dynamic fields for update_passport
  new_passport_number: string;
  date_of_issue: string;
  date_of_expiry: string;
  issuing_office: string;
  passport_file: string | null;
}

function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    in_progress: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    approved: "bg-primary/10 text-primary hover:bg-primary/15",
    rejected: "bg-red-100 text-red-800 hover:bg-red-100",
    completed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    cancelled: "bg-slate-200 text-slate-700 hover:bg-slate-200",
  };
  const key = (status || "").toLowerCase();
  return <Badge className={map[key] || "bg-slate-100 text-slate-800"}>{t(key)}</Badge>;
}

export default function Documents() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { markRead } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");

  const [rows, setRows] = useState<DocumentRequest[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [edit, setEdit] = useState<DocumentRequest | null>(null);
  const [saving, setSaving] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");

  // Student profile (for student user)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);

  // Staff: list of students map
  const [studentsMap, setStudentsMap] = useState<Map<string, StudentProfile>>(new Map());

  // System settings state (ticket window + print customization)
  const [systemSettings, setSystemSettings] = useState<SystemSettingData>({
    is_ticket_window_open: false,
    print_letterhead_url: null,
    print_logo_url: null,
    print_header_title_ar: "المملكة العربية السعودية",
    print_header_subtitle_ar:
      "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي",
    print_header_title_en: "Kingdom of Saudi Arabia",
    print_header_subtitle_en:
      "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin",
    print_layout_style: "standard",
    print_signature_name: "د. فهد الشمري (مشرف الإسكان)",
    print_footer_text: null,
  });
  const [togglingWindow, setTogglingWindow] = useState(false);

  // Print settings modal state (Admin)
  const [openPrintSettings, setOpenPrintSettings] = useState(false);
  const [printSettingsTab, setPrintSettingsTab] = useState<"editor" | "preview">("editor");
  const [printLayoutStyle, setPrintLayoutStyle] = useState<"standard" | "custom_image">("standard");
  const [printLetterheadUrl, setPrintLetterheadUrl] = useState<string | null>(null);
  const [printLogoUrl, setPrintLogoUrl] = useState<string | null>(null);
  const [printHeaderTitleAr, setPrintHeaderTitleAr] = useState("المملكة العربية السعودية");
  const [printHeaderSubtitleAr, setPrintHeaderSubtitleAr] = useState(
    "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي"
  );
  const [printHeaderTitleEn, setPrintHeaderTitleEn] = useState("Kingdom of Saudi Arabia");
  const [printHeaderSubtitleEn, setPrintHeaderSubtitleEn] = useState(
    "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin"
  );
  const [printSignatureName, setPrintSignatureName] = useState("د. فهد الشمري (مشرف الإسكان)");
  const [printFooterText, setPrintFooterText] = useState("");
  const [savingPrintSettings, setSavingPrintSettings] = useState(false);

  // Dossier expansion & printing
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [printableDoc, setPrintableDoc] = useState<{
    doc: DocumentRequest;
    student: StudentProfile | null;
  } | null>(null);

  // Student Edit & Cancel modal state
  const [docToEdit, setDocToEdit] = useState<DocumentRequest | null>(null);
  const [docToCancel, setDocToCancel] = useState<DocumentRequest | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const handleCancelDocument = async () => {
    if (!docToCancel) return;
    setCancelling(true);
    try {
      await api.patch(`/documents/${docToCancel.id}`, { status: "cancelled" });
      toast.success(t("request_cancelled_success"));
      setDocToCancel(null);
      load();
    } catch (e) {
      const errMsg = axios.isAxiosError(e)
        ? e.response?.data?.message || e.response?.data?.detail
        : undefined;
      toast.error(formatApiError(errMsg));
    } finally {
      setCancelling(false);
    }
  };

  // Check if current student has a completed Iqomah renewal to show notification
  const hasCompletedIqomahRenewal = useMemo(() => {
    return (
      !isStaff &&
      rows.some(
        (r) => r.request_type === "iqomah_renewal" && r.status.toLowerCase() === "completed"
      )
    );
  }, [isStaff, rows]);

  // Load document requests and ticket window status
  const load = async () => {
    try {
      const res = await api.get("/documents");
      setRows(res.data);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  const loadSystemSettings = async () => {
    try {
      const res = await api.get("/settings/system");
      if (res.data) {
        setSystemSettings(res.data);
        setPrintLayoutStyle((res.data.print_layout_style as "standard" | "custom_image") || "standard");
        setPrintLetterheadUrl(res.data.print_letterhead_url || null);
        setPrintLogoUrl(res.data.print_logo_url || null);
        setPrintHeaderTitleAr(res.data.print_header_title_ar ?? "المملكة العربية السعودية");
        setPrintHeaderSubtitleAr(
          res.data.print_header_subtitle_ar ??
            "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي"
        );
        setPrintHeaderTitleEn(res.data.print_header_title_en ?? "Kingdom of Saudi Arabia");
        setPrintHeaderSubtitleEn(
          res.data.print_header_subtitle_en ??
            "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin"
        );
        setPrintSignatureName(res.data.print_signature_name ?? "د. فهد الشمري (مشرف الإسكان)");
        setPrintFooterText(res.data.print_footer_text || "");
      }
    } catch {
      // Fallback: remains default
    }
  };

  const handleOpenPrintSettings = () => {
    setPrintLayoutStyle((systemSettings.print_layout_style as "standard" | "custom_image") || "standard");
    setPrintLetterheadUrl(systemSettings.print_letterhead_url || null);
    setPrintLogoUrl(systemSettings.print_logo_url || null);
    setPrintHeaderTitleAr(systemSettings.print_header_title_ar ?? "المملكة العربية السعودية");
    setPrintHeaderSubtitleAr(
      systemSettings.print_header_subtitle_ar ??
        "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي"
    );
    setPrintHeaderTitleEn(systemSettings.print_header_title_en ?? "Kingdom of Saudi Arabia");
    setPrintHeaderSubtitleEn(
      systemSettings.print_header_subtitle_en ??
        "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin"
    );
    setPrintSignatureName(systemSettings.print_signature_name ?? "د. فهد الشمري (مشرف الإسكان)");
    setPrintFooterText(systemSettings.print_footer_text || "");
    setPrintSettingsTab("editor");
    setOpenPrintSettings(true);
  };

  const loadStudentProfile = async () => {
    try {
      const res = await api.get("/students/me");
      setStudentProfile(res.data);
    } catch {
      // Silent error for non-student
    }
  };

  const loadAllStudentsForStaff = async () => {
    try {
      const res = await api.get("/students");
      if (Array.isArray(res.data)) {
        const map = new Map<string, StudentProfile>();
        for (const s of res.data) {
          if (s.user_id) map.set(s.user_id, s);
          if (s.id) map.set(s.id, s);
        }
        setStudentsMap(map);
      }
    } catch {
      // Silent catch
    }
  };

  useEffect(() => {
    load();
    loadSystemSettings();
    if (isStaff) {
      loadAllStudentsForStaff();
    } else {
      loadStudentProfile();
      if (user && user.role === "student") {
        markRead("documents");
      }
    }
  }, [isStaff, user, markRead]);

  // Toggle ticket window (Staff/Admin)
  const toggleTicketWindow = async (newVal: boolean) => {
    setTogglingWindow(true);
    try {
      await api.patch("/settings/system", { is_ticket_window_open: newVal });
      setSystemSettings((prev) => ({ ...prev, is_ticket_window_open: newVal }));
      toast.success(
        newVal ? t("ticket_window_opened_toast") : t("ticket_window_closed_toast")
      );
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setTogglingWindow(false);
    }
  };

  // Save print settings (Admin)
  const savePrintSettings = async () => {
    setSavingPrintSettings(true);
    try {
      const payload = {
        print_layout_style: printLayoutStyle,
        print_letterhead_url: printLetterheadUrl || null,
        print_logo_url: printLogoUrl || null,
        print_header_title_ar: printHeaderTitleAr.trim() || null,
        print_header_subtitle_ar: printHeaderSubtitleAr.trim() || null,
        print_header_title_en: printHeaderTitleEn.trim() || null,
        print_header_subtitle_en: printHeaderSubtitleEn.trim() || null,
        print_signature_name: printSignatureName.trim() || null,
        print_footer_text: printFooterText.trim() || null,
      };
      const res = await api.patch("/settings/system", payload);
      if (res.data) {
        setSystemSettings(res.data);
      }
      toast.success(t("print_settings_saved"));
      setOpenPrintSettings(false);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSavingPrintSettings(false);
    }
  };

  // Submit edit (status & admin_note)
  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!edit) return;

    // Check softcopy letter of enrollment requirement
    const isSoftcopy =
      edit.request_type === "letter_of_enrollment" &&
      edit.dynamic_data?.delivery_method === "softcopy";
    if (
      isSoftcopy &&
      (edit.status || "").toLowerCase() === "completed" &&
      !edit.result_file_id
    ) {
      toast.error(t("upload_result_file"));
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/documents/${edit.id}`, {
        status: edit.status,
        admin_note: edit.admin_note,
        result_file_id: edit.result_file_id || null,
      });
      toast.success(lang === "ar" ? "تم تحديث الطلب بنجاح" : "Updated successfully");
      setEdit(null);
      load();
      if (isStaff) loadAllStudentsForStaff();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSaving(false);
    }
  };

  // Helper to resolve student profile for a document
  const getStudentForDoc = (doc: DocumentRequest): StudentProfile | null => {
    if (!isStaff) return studentProfile;
    return studentsMap.get(doc.user_id) || null;
  };

  // Print trigger
  const handlePrintDossier = (doc: DocumentRequest) => {
    if (!isStaff) return;
    const student = getStudentForDoc(doc);
    setPrintableDoc({ doc, student });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Filtered rows for Admin & Student
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      // Client-side safety check: Student MUST only see their own documents
      if (!isStaff && user && r.user_id !== user.id) {
        return false;
      }

      // 1. Status Filter
      if (filterStatus !== "ALL" && r.status.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      // 2. Request Type Filter
      if (filterType !== "ALL" && r.request_type !== filterType) {
        return false;
      }

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const student = getStudentForDoc(r);
        const studentName = (
          student?.arabicName ||
          student?.englishName ||
          student?.full_name ||
          r.user_name ||
          ""
        ).toLowerCase();
        const residencyNum = (
          student?.residency_number ||
          student?.residencyNumber ||
          ""
        ).toLowerCase();
        const passportNum = (
          student?.passport_number ||
          student?.passportNumber ||
          ""
        ).toLowerCase();
        const newPassportNum = (
          r.dynamic_data?.new_passport_number || ""
        ).toLowerCase();
        const notes = (r.notes || "").toLowerCase();
        const dynData = JSON.stringify(r.dynamic_data || "").toLowerCase();

        const matches =
          studentName.includes(q) ||
          residencyNum.includes(q) ||
          passportNum.includes(q) ||
          newPassportNum.includes(q) ||
          notes.includes(q) ||
          dynData.includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [rows, filterStatus, filterType, searchQuery, studentsMap, studentProfile]);

  return (
    <div className="space-y-6" data-testid="documents-page">
      {/* ── Notification Banner: Completed Iqomah Renewal (Student Side) ── */}
      {hasCompletedIqomahRenewal && (
        <Alert
          className="border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm print:hidden"
          data-testid="iqomah-renewed-alert"
        >
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="flex-1 space-y-1">
            <AlertTitle className="font-bold text-emerald-900">
              {t("iqomah_renewed_notification_title")}
            </AlertTitle>
            <AlertDescription className="text-xs text-emerald-800 leading-relaxed">
              {t("iqomah_renewed_notification_desc")}
            </AlertDescription>
            <div className="pt-1">
              <a href="/profile">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-emerald-700 hover:bg-emerald-800 text-white gap-1.5 h-7 text-xs"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>{t("update_profile_now")}</span>
                </Button>
              </a>
            </div>
          </div>
        </Alert>
      )}

      {/* ── Page Header & Action Controls ──────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {t("documents")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {filteredRows.length} {t("documents").toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Admin / Staff Controls: Print Settings & Ticket Window Toggle */}
          {isStaff && (
            <>
              {/* Print Settings Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenPrintSettings}
                className="gap-1.5"
                data-testid="print-settings-btn"
              >
                <Sliders className="h-4 w-4 text-primary" />
                <span>{t("print_settings")}</span>
              </Button>

              {/* Ticket Window Toggle Switch */}
              <div
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
                data-testid="ticket-window-toggle"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  {systemSettings.is_ticket_window_open ? (
                    <Unlock className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-amber-600" />
                  )}
                  <span>{t("ticket_window_status")}:</span>
                </div>
                <span
                  className={`font-semibold ${
                    systemSettings.is_ticket_window_open
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }`}
                >
                  {systemSettings.is_ticket_window_open
                    ? t("ticket_window_open")
                    : t("ticket_window_closed")}
                </span>
                <Switch
                  checked={systemSettings.is_ticket_window_open}
                  disabled={togglingWindow}
                  onCheckedChange={toggleTicketWindow}
                  aria-label={t("toggle_ticket_window")}
                />
              </div>
            </>
          )}

          {/* Student: New Request Button & Dialog */}
          {!isStaff && (
            <>
              <Button
                className="gap-2"
                data-testid="new-document-btn"
                onClick={() => setOpenNew(true)}
              >
                <Plus className="h-4 w-4" />
                {t("new_document_request")}
              </Button>
              <NewDocumentRequest
                open={openNew}
                onOpenChange={setOpenNew}
                rows={rows}
                studentProfile={studentProfile}
                systemSettings={systemSettings}
                onSuccess={load}
              />
            </>
          )}
        </div>
      </div>

      {/* ── Search Bar & Filter Controls (Admin & Staff) ───── */}
      {isStaff && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm print:hidden">
          {/* Search input */}
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search_documents_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 h-9"
              data-testid="search-documents-input"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger
                className="w-[140px] sm:w-[150px] h-9 text-xs"
                data-testid="filter-status-select"
              >
                <SelectValue placeholder={t("filter_by_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("all_statuses")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Request Type filter */}
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger
                className="w-[160px] sm:w-[170px] h-9 text-xs"
                data-testid="filter-type-select"
              >
                <SelectValue placeholder={t("filter_by_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("all_types")}</SelectItem>
                {ALL_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Reset filter button */}
            {(searchQuery || filterStatus !== "ALL" || filterType !== "ALL") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setFilterStatus("ALL");
                  setFilterType("ALL");
                }}
                className="h-9 px-2 text-xs text-muted-foreground"
                title="Reset filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Document List & Dossier Views ──────────────────── */}
      <div className="grid gap-4 print:hidden">
        {filteredRows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("no_data")}
          </Card>
        )}

        {filteredRows.map((r) => {
          const isExpanded = expandedDocId === r.id;
          const student = getStudentForDoc(r);
          const hasDynamicData = !!r.dynamic_data && r.dynamic_data.destination;

          return (
            <Card
              key={r.id}
              className={`p-5 border-slate-200 transition-colors ${
                isExpanded
                  ? "ring-2 ring-primary/20 border-primary/40 bg-slate-50/40"
                  : "hover:border-primary/30"
              }`}
              data-testid={`doc-row-${r.id}`}
            >
              {/* Summary Row */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]"
                    >
                      {t(r.request_type)}
                    </Badge>
                    {statusBadge(r.status, t)}
                    {isStaff && (
                      <span className="text-xs font-medium text-slate-700">
                        · {r.user_name}
                      </span>
                    )}
                    {hasDynamicData && (
                      <Badge
                        variant="outline"
                        className="bg-sky-50 text-sky-800 border-sky-200 text-[10px] gap-1"
                      >
                        <Plane className="h-3 w-3" />
                        <span>
                          HAS ➔{" "}
                          {r.dynamic_data?.destination?.split(" - ")[0] ||
                            r.dynamic_data?.destination}
                        </span>
                      </Badge>
                    )}
                    {r.request_type === "update_passport" && (
                      <Badge
                        variant="outline"
                        className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] gap-1"
                      >
                        <CreditCard className="h-3 w-3" />
                        <span>
                          {r.dynamic_data?.new_passport_number || "Passport Update"}
                        </span>
                      </Badge>
                    )}
                    {r.request_type === "exit_reentry_visa" && r.dynamic_data?.visa_validity_type && (
                      <Badge
                        variant="outline"
                        className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] gap-1"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>
                          {r.dynamic_data.visa_validity_type === "return_before"
                            ? `${t("return_to_ksa_before")}: ${r.dynamic_data.return_to_ksa_before || "—"}`
                            : `${t("duration_in_days")}: ${r.dynamic_data.duration_days || "—"} ${t("days")}`}
                        </span>
                      </Badge>
                    )}
                    {r.request_type === "letter_of_enrollment" && r.dynamic_data?.addressed_to && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] gap-1"
                      >
                        <FileText className="h-3 w-3" />
                        <span>
                          {t("addressed_to")}: {r.dynamic_data.addressed_to === "Other" ? r.dynamic_data.addressed_to_other : r.dynamic_data.addressed_to}
                          {r.dynamic_data.letter_language && ` (${r.dynamic_data.letter_language.toUpperCase()})`}
                        </span>
                      </Badge>
                    )}
                  </div>

                  {r.notes && (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                      {r.notes}
                    </p>
                  )}

                  {/* Standard Attachment Pills (if any) */}
                  {r.attachment_file_ids && r.attachment_file_ids.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.attachment_file_ids.map((fid) => (
                        <AttachmentPill key={fid} fileId={fid} />
                      ))}
                    </div>
                  )}

                  {r.admin_note && (
                    <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                        {t("admin_note")}
                      </div>
                      <div className="text-sm text-slate-700">{r.admin_note}</div>
                    </div>
                  )}

                  <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                    {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>

                {/* Row Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Download Finalized Letter (PDF) for Student & Staff when COMPLETED */}
                  {r.status.toLowerCase() === "completed" && r.result_file_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 font-medium shadow-xs"
                      data-testid={`download-result-btn-${r.id}`}
                    >
                      <a
                        href={fileDownloadUrl(r.result_file_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                      >
                        <Download className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{t("download_letter")}</span>
                      </a>
                    </Button>
                  )}

                  {/* Student Edit & Cancel buttons for pending requests */}
                  {!isStaff && r.status.toLowerCase() === "pending" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-slate-700 hover:text-primary"
                        onClick={() => setDocToEdit(r)}
                        data-testid={`edit-doc-btn-${r.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5 text-amber-600" />
                        <span>{t("edit_request")}</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => setDocToCancel(r)}
                        data-testid={`cancel-doc-btn-${r.id}`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{t("cancel_request")}</span>
                      </Button>
                    </>
                  )}

                  {/* Staff & Admin Management Actions (Dossier View, Print, Status Update) */}
                  {isStaff && (
                    <>
                      {/* Toggle Dossier View */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setExpandedDocId(isExpanded ? null : r.id)}
                        data-testid={`view-dossier-btn-${r.id}`}
                      >
                        <Eye className="h-3.5 w-3.5 text-primary" />
                        <span>{t("student_dossier")}</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>

                      {/* Print Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-slate-700 hover:text-primary"
                        onClick={() => handlePrintDossier(r)}
                        data-testid={`print-doc-${r.id}`}
                        title={t("print_report")}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{t("print_report")}</span>
                      </Button>

                      {/* Admin Status Update */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEdit({ ...r })}
                        data-testid={`update-doc-${r.id}`}
                      >
                        {t("update")}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* ── Dossier View (Inline Card for Admin & Staff ONLY) ──────── */}
              {isExpanded && isStaff && (
                <div
                  className="mt-5 pt-5 border-t border-slate-200/80 space-y-5 animate-in fade-in-50 duration-200"
                  data-testid={`dossier-card-${r.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {student?.arabicName ||
                            student?.englishName ||
                            student?.full_name ||
                            r.user_name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {t("student_dossier")} · ID: {r.id.slice(0, 8).toUpperCase()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={
                          (student?.residency_type || student?.residencyType) ===
                          "STUDENT_VISA"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-emerald-100 text-emerald-800"
                        }
                      >
                        {(student?.residency_type || student?.residencyType) ===
                        "STUDENT_VISA"
                          ? "Student Visa (فيزا طالب)"
                          : "Iqomah (إقامة)"}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1.5 h-8 text-xs"
                        onClick={() => handlePrintDossier(r)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {t("print_report")}
                      </Button>
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {t("full_name")}
                      </span>
                      <span className="text-xs font-medium text-slate-800 mt-0.5 block truncate">
                        {student?.englishName ||
                          student?.arabicName ||
                          student?.full_name ||
                          r.user_name}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {t("passport_number")}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-800 mt-0.5 block">
                        {student?.passport_number || student?.passportNumber || "—"}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {t("residency_number_label")}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-800 mt-0.5 block">
                        {student?.residency_number || student?.residencyNumber || "—"}
                      </span>
                    </div>

                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                        {t("current_residency_expiry")}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-800 mt-0.5 block">
                        {student?.residency_expiry || student?.residencyExpiry || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Data View for Update Passport Requests */}
                  {r.request_type === "update_passport" && r.dynamic_data && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs border-b border-amber-200 pb-2">
                        <CreditCard className="h-4 w-4 text-amber-700" />
                        <span>{t("update_passport")} (Data Baru yang Diajukan)</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white/90 p-2.5 rounded border border-amber-100">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">
                            {t("new_passport_number")}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                            {r.dynamic_data.new_passport_number || "—"}
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded border border-amber-100">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">
                            {t("date_of_issue")}
                          </span>
                          <span className="text-xs font-mono text-slate-900 mt-0.5 block">
                            {r.dynamic_data.date_of_issue || "—"}
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded border border-amber-100">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">
                            {t("date_of_expiry")}
                          </span>
                          <span className="text-xs font-mono text-slate-900 mt-0.5 block">
                            {r.dynamic_data.date_of_expiry || "—"}
                          </span>
                        </div>
                        <div className="bg-white/90 p-2.5 rounded border border-amber-100">
                          <span className="text-[10px] uppercase font-bold text-amber-800 block">
                            {t("issuing_office")}
                          </span>
                          <span className="text-xs font-medium text-slate-900 mt-0.5 block">
                            {r.dynamic_data.issuing_office || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Data View for Ticket Requests */}
                  {hasDynamicData && (
                    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-sky-900 font-semibold text-xs border-b border-sky-200 pb-2">
                        <Plane className="h-4 w-4 text-sky-700" />
                        <span>{t("ticket_flight_details")}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/80 p-2.5 rounded border border-sky-100">
                          <span className="text-[10px] uppercase font-bold text-sky-800 block">
                            {t("route")}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                            Hail (HAS) ➔ {r.dynamic_data?.destination}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-sky-100">
                          <span className="text-[10px] uppercase font-bold text-sky-800 block">
                            {t("trip_type")}
                          </span>
                          <span className="text-xs font-medium text-slate-900 mt-0.5 block">
                            {r.dynamic_data?.trip_type === "round_trip"
                              ? t("round_trip")
                              : t("one_way")}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-sky-100">
                          <span className="text-[10px] uppercase font-bold text-sky-800 block">
                            {r.dynamic_data?.trip_type === "round_trip"
                              ? t("departure_and_return_date")
                              : t("departure_date")}
                          </span>
                          <span className="text-xs font-mono font-medium text-slate-900 mt-0.5 block">
                            {r.dynamic_data?.departure_date || "—"}
                            {r.dynamic_data?.trip_type === "round_trip" &&
                              r.dynamic_data?.return_date && (
                                <span className="ms-1 font-semibold text-sky-800">
                                  ➔ {r.dynamic_data.return_date}
                                </span>
                              )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Data View for Exit/Re-entry Visa Requests */}
                  {r.request_type === "exit_reentry_visa" && r.dynamic_data?.visa_validity_type && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-purple-900 font-semibold text-xs border-b border-purple-200 pb-2">
                        <Plane className="h-4 w-4 text-purple-700" />
                        <span>{t("exit_reentry_visa")} · {t("visa_validity")}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/80 p-2.5 rounded border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-purple-800 block">
                            {t("visa_validity")}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                            {r.dynamic_data.visa_validity_type === "return_before"
                              ? t("return_to_ksa_before")
                              : t("duration_in_days")}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-purple-800 block">
                            {r.dynamic_data.visa_validity_type === "return_before"
                              ? t("return_to_ksa_before")
                              : t("duration_in_days")}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-900 mt-0.5 block">
                            {r.dynamic_data.visa_validity_type === "return_before"
                              ? r.dynamic_data.return_to_ksa_before || "—"
                              : `${r.dynamic_data.duration_days || "—"} ${t("days")}`}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-purple-100">
                          <span className="text-[10px] uppercase font-bold text-purple-800 block">
                            {t("current_residency_expiry")}
                          </span>
                          <span className="text-xs font-mono text-slate-900 mt-0.5 block">
                            {r.dynamic_data.resident_id_expiry ||
                              student?.residency_expiry ||
                              student?.residencyExpiry ||
                              "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Data View for Letter of Enrollment Requests */}
                  {r.request_type === "letter_of_enrollment" && r.dynamic_data?.addressed_to && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                      <div className="flex items-center gap-2 text-emerald-900 font-semibold text-xs border-b border-emerald-200 pb-2">
                        <FileText className="h-4 w-4 text-emerald-700" />
                        <span>{t("letter_of_enrollment")}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-white/80 p-2.5 rounded border border-emerald-100">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                            {t("addressed_to")}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 mt-0.5 block">
                            {r.dynamic_data.addressed_to === "Other"
                              ? r.dynamic_data.addressed_to_other || "Other"
                              : r.dynamic_data.addressed_to}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-emerald-100">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                            {t("letter_language")}
                          </span>
                          <span className="text-xs font-medium text-slate-900 mt-0.5 block">
                            {r.dynamic_data.letter_language === "ar"
                              ? t("arabic_lang")
                              : t("english_lang")}
                          </span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded border border-emerald-100">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 block">
                            {t("delivery_method")}
                          </span>
                          <span className="text-xs font-medium text-slate-900 mt-0.5 block">
                            {r.dynamic_data.delivery_method === "softcopy"
                              ? t("softcopy")
                              : t("hardcopy")}
                          </span>
                        </div>
                      </div>

                      {/* Finalized Letter PDF Download inside Dossier */}
                      {r.result_file_id && (
                        <div className="pt-2.5 border-t border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            <span>{t("upload_result_file")}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-8 gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 bg-white border-emerald-300"
                          >
                            <a
                              href={fileDownloadUrl(r.result_file_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                            >
                              <Download className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{t("download_letter")}</span>
                            </a>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Render Gambar Paspor dan Dokumen Tinggal Secara Berdampingan */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <CreditCard className="h-4 w-4 text-primary" />
                      <span>{t("student_dossier")}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* 1. Passport Preview Card */}
                      <DocumentPreviewCard
                        fileId={
                          r.request_type === "update_passport" && r.dynamic_data?.passport_file
                            ? r.dynamic_data.passport_file
                            : student?.passport_file_id || null
                        }
                        title={
                          r.request_type === "update_passport" && r.dynamic_data?.passport_file
                            ? "صورة جواز السفر الجديد (New Passport)"
                            : t("passport_scan")
                        }
                        subtitle={`No: ${
                          r.request_type === "update_passport" && r.dynamic_data?.new_passport_number
                            ? r.dynamic_data.new_passport_number
                            : student?.passport_number || student?.passportNumber || "—"
                        }`}
                      />

                      {/* 2. Residency Document Preview Card */}
                      <DocumentPreviewCard
                        fileId={
                          student?.residency_file_id ||
                          student?.iqomah_file_id ||
                          null
                        }
                        title={
                          (student?.residency_type || student?.residencyType) ===
                          "STUDENT_VISA"
                            ? lang === "ar"
                              ? "صورة تأشيرة الطالب"
                              : "Student Visa Scan"
                            : t("residency_scan")
                        }
                        subtitle={`No: ${student?.residency_number || student?.residencyNumber || "—"}`}
                      />
                    </div>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* ── Admin: Print Settings Dialog ───────────────────── */}
      <Dialog open={openPrintSettings} onOpenChange={setOpenPrintSettings}>
        <DialogContent
          className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6"
          data-testid="print-settings-dialog"
        >
          <DialogHeader className="shrink-0 pb-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-primary" />
              <span>{t("print_settings")}</span>
            </DialogTitle>
          </DialogHeader>

          <Tabs
            value={printSettingsTab}
            onValueChange={(v) => setPrintSettingsTab(v as "editor" | "preview")}
            className="flex-1 overflow-hidden flex flex-col"
          >
            <TabsList className="grid grid-cols-2 mb-4 shrink-0">
              <TabsTrigger
                value="editor"
                className="gap-2"
                data-testid="tab-editor-trigger"
              >
                <Sliders className="h-4 w-4" />
                <span>{t("tab_editor")}</span>
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="gap-2"
                data-testid="tab-preview-trigger"
              >
                <Eye className="h-4 w-4" />
                <span>{t("tab_preview")}</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB CONTENT: EDITOR */}
            <TabsContent
              value="editor"
              className="flex-1 overflow-y-auto pr-1 space-y-5 focus-visible:ring-0 mt-0"
              data-testid="tab-editor-content"
            >
              {/* Header Style Radio Selector */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div>
                  <Label className="text-sm font-bold text-slate-800">
                    {t("print_header_type")}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    اختر ما إذا كنت ترغب في استخدام ترويسة نظامية ديناميكية أو رفع صورة بنر كاملة
                  </p>
                </div>

                <RadioGroup
                  value={printLayoutStyle}
                  onValueChange={(val) =>
                    setPrintLayoutStyle(val as "standard" | "custom_image")
                  }
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                >
                  <div
                    onClick={() => setPrintLayoutStyle("standard")}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors bg-white",
                      printLayoutStyle === "standard"
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <RadioGroupItem
                      value="standard"
                      id="opt_standard"
                      className="mt-1 shrink-0"
                    />
                    <label
                      htmlFor="opt_standard"
                      className="cursor-pointer space-y-1 block"
                    >
                      <span className="font-semibold text-sm text-slate-900 block">
                        {t("print_style_standard")}
                      </span>
                      <span className="text-xs text-muted-foreground block leading-relaxed">
                        {t("print_style_standard_desc")}
                      </span>
                    </label>
                  </div>

                  <div
                    onClick={() => setPrintLayoutStyle("custom_image")}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors bg-white",
                      printLayoutStyle === "custom_image"
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                        : "border-slate-200 hover:border-slate-300"
                    )}
                  >
                    <RadioGroupItem
                      value="custom_image"
                      id="opt_custom_image"
                      className="mt-1 shrink-0"
                    />
                    <label
                      htmlFor="opt_custom_image"
                      className="cursor-pointer space-y-1 block"
                    >
                      <span className="font-semibold text-sm text-slate-900 block">
                        {t("print_style_custom_image")}
                      </span>
                      <span className="text-xs text-muted-foreground block leading-relaxed">
                        {t("print_style_custom_image_desc")}
                      </span>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              {/* Conditional Inputs based on Header Style */}
              {printLayoutStyle === "custom_image" ? (
                /* Option 2: Custom Banner Image */
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <Label className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                    <Building className="h-4 w-4 text-primary" />
                    <span>{t("print_letterhead_image")}</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    قم برفع صورة كليشة كاملة تتضمن شعار الجامعة والترويسة (PNG أو JPG عالي الدقة).
                  </p>
                  <FileUpload
                    kind="letterhead"
                    value={printLetterheadUrl}
                    onChange={setPrintLetterheadUrl}
                    label={t("print_letterhead_image")}
                    accept="image/*"
                  />
                  {printLetterheadUrl && (
                    <div className="rounded border border-slate-200 p-2 bg-slate-50 mt-2">
                      <span className="text-[10px] text-muted-foreground block mb-1">
                        معاينة الصورة المرفوعة:
                      </span>
                      <img
                        src={fileDownloadUrl(printLetterheadUrl)}
                        alt="Letterhead Preview"
                        className="max-h-24 max-w-full object-contain mx-auto"
                      />
                    </div>
                  )}
                </div>
              ) : (
                /* Option 1: Standard Dynamic Text & Logo */
                <div className="space-y-4">
                  {/* Center Logo Upload */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                        <Building className="h-4 w-4 text-primary" />
                        <span>{t("print_logo_label")}</span>
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        {t("print_logo_hint")}
                      </span>
                    </div>
                    <FileUpload
                      kind="logo"
                      value={printLogoUrl}
                      onChange={setPrintLogoUrl}
                      label={t("print_logo_label")}
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    />
                    {printLogoUrl && (
                      <div className="flex items-center gap-3 rounded border border-slate-200 p-2 bg-slate-50 mt-2">
                        <img
                          src={fileDownloadUrl(printLogoUrl)}
                          alt="Logo Preview"
                          className="w-12 h-12 object-contain rounded border bg-white p-1"
                        />
                        <div className="text-xs text-slate-600">
                          <span className="font-semibold block text-slate-800">تم اختيار الشعار</span>
                          <span>سيظهر في وسط ترويسة الصفحة الرسمية</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Two Columns: Arabic & English Headers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Arabic Right Header */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3" dir="rtl">
                      <div className="border-b border-slate-100 pb-2">
                        <Label className="font-bold text-sm text-slate-800 block text-right font-arabic">
                          {t("print_header_arabic")}
                        </Label>
                        <span className="text-[11px] text-muted-foreground block text-right">
                          تظهر في الجانب الأيمن من الترويسة
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 block text-right">
                          {t("print_header_title_ar_label")}
                        </Label>
                        <Input
                          value={printHeaderTitleAr}
                          onChange={(e) => setPrintHeaderTitleAr(e.target.value)}
                          placeholder="المملكة العربية السعودية"
                          className="font-arabic text-sm text-right"
                          dir="rtl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 block text-right">
                          {t("print_header_subtitle_ar_label")}
                        </Label>
                        <Textarea
                          rows={3}
                          value={printHeaderSubtitleAr}
                          onChange={(e) => setPrintHeaderSubtitleAr(e.target.value)}
                          placeholder={"وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي"}
                          className="font-arabic text-xs text-right leading-relaxed"
                          dir="rtl"
                        />
                        <span className="text-[10px] text-muted-foreground block text-right">
                          {t("print_header_subtitle_hint")}
                        </span>
                      </div>
                    </div>

                    {/* English Left Header */}
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3" dir="ltr">
                      <div className="border-b border-slate-100 pb-2">
                        <Label className="font-bold text-sm text-slate-800 block text-left">
                          {t("print_header_english")}
                        </Label>
                        <span className="text-[11px] text-muted-foreground block text-left">
                          Appears on the left side of the letterhead
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 block text-left">
                          {t("print_header_title_en_label")}
                        </Label>
                        <Input
                          value={printHeaderTitleEn}
                          onChange={(e) => setPrintHeaderTitleEn(e.target.value)}
                          placeholder="Kingdom of Saudi Arabia"
                          className="text-sm text-left"
                          dir="ltr"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700 block text-left">
                          {t("print_header_subtitle_en_label")}
                        </Label>
                        <Textarea
                          rows={3}
                          value={printHeaderSubtitleEn}
                          onChange={(e) => setPrintHeaderSubtitleEn(e.target.value)}
                          placeholder={"Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin"}
                          className="text-xs text-left leading-relaxed"
                          dir="ltr"
                        />
                        <span className="text-[10px] text-muted-foreground block text-left">
                          {t("print_header_subtitle_hint")}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Signature Area Customization */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-800">
                    {t("print_signature_section")}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    تخصيص أسماء ومسميات الاعتماد والتواقيع الرسمية أسفل التقرير المطبوع
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {t("print_applicant_label")}
                    </Label>
                    <Input
                      value="توقيع الطالب مقدم الطلب"
                      disabled
                      className="bg-slate-100/80 text-slate-500 text-xs cursor-not-allowed"
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      يعتمد تلقائياً اسم الطالب صاحب المعاملة
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {t("print_signature_name_label")}
                    </Label>
                    <Input
                      value={printSignatureName}
                      onChange={(e) => setPrintSignatureName(e.target.value)}
                      placeholder="د. فهد الشمري (مشرف الإسكان)"
                      className="text-xs bg-white"
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      الاسم المطبوع أسفل خط التوقيع
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      {t("print_stamp_label")}
                    </Label>
                    <Input
                      value="الختم الرسمي والتاريخ"
                      disabled
                      className="bg-slate-100/80 text-slate-500 text-xs cursor-not-allowed"
                    />
                    <span className="text-[10px] text-muted-foreground block">
                      دائرة الختم الرسمي لإدارة الإسكان
                    </span>
                  </div>
                </div>

                {/* Optional Footer Text */}
                <div className="pt-3 border-t border-slate-200 space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    {t("print_footer_text_label")}
                  </Label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. وثيقة رسمية صادرة من عمادة شؤون الطلاب - جامعة حائل..."
                    value={printFooterText}
                    onChange={(e) => setPrintFooterText(e.target.value)}
                    className="text-xs bg-white"
                  />
                </div>
              </div>
            </TabsContent>

            {/* TAB CONTENT: PREVIEW */}
            <TabsContent
              value="preview"
              className="flex-1 overflow-y-auto pr-1 focus-visible:ring-0 mt-0"
              data-testid="tab-preview-content"
            >
              <div className="bg-slate-200/70 p-4 sm:p-6 rounded-lg flex flex-col items-center justify-center">
                <div className="mb-3 text-center">
                  <span className="text-xs font-bold text-slate-700 block">
                    {t("print_preview_title")}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {t("print_preview_hint")}
                  </span>
                </div>

                {/* Simulated A4 Paper */}
                <div
                  className="w-full max-w-[640px] aspect-[1/1.414] bg-white shadow-2xl border border-slate-300 rounded p-6 sm:p-8 text-black flex flex-col justify-between text-[11px] select-none transition-all"
                  dir="rtl"
                >
                  {/* Top Area: Letterhead Header */}
                  <div>
                    {printLayoutStyle === "custom_image" ? (
                      <div className="border-b-2 border-slate-900 pb-3 mb-4 text-center">
                        {printLetterheadUrl ? (
                          <img
                            src={fileDownloadUrl(printLetterheadUrl)}
                            alt="Letterhead Preview"
                            className="w-full max-h-20 object-contain mx-auto"
                          />
                        ) : (
                          <div className="h-16 flex items-center justify-center border-2 border-dashed border-slate-300 rounded text-slate-400 text-xs">
                            لم يتم رفع صورة الكليشة بعد (قم برفعها في تبويب المحرر)
                          </div>
                        )}
                        <div className="text-center mt-2">
                          <h2 className="text-xs font-extrabold uppercase tracking-wide underline decoration-1 underline-offset-2">
                            استمارة طلب وثيقة وبيانات الإقامة والجوازات
                          </h2>
                          <div className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-0.5">
                            Official Document & Immigration Request Dossier
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border-b-2 border-slate-900 pb-3 mb-4">
                        <div className="flex items-center justify-between gap-2">
                          {/* Arabic Right Header */}
                          <div className="text-right space-y-0.5 max-w-[38%]">
                            <div className="text-xs font-bold font-arabic leading-tight">
                              {printHeaderTitleAr || "المملكة العربية السعودية"}
                            </div>
                            {(printHeaderSubtitleAr || "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي")
                              .split("\n")
                              .filter(Boolean)
                              .map((line, idx) => (
                                <div
                                  key={idx}
                                  className="text-[10px] font-semibold font-arabic leading-tight text-slate-800"
                                >
                                  {line}
                                </div>
                              ))}
                          </div>

                          {/* Center Logo */}
                          <div className="text-center px-2 shrink-0">
                            {printLogoUrl ? (
                              <img
                                src={fileDownloadUrl(printLogoUrl)}
                                alt="University Logo"
                                className="w-12 h-12 object-contain mx-auto"
                              />
                            ) : (
                              <div className="w-12 h-12 mx-auto rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-xs text-slate-900">
                                UoH
                              </div>
                            )}
                            <div className="text-[8px] font-bold uppercase tracking-wider text-slate-700 mt-0.5">
                              University of Hail
                            </div>
                          </div>

                          {/* English Left Header */}
                          <div className="text-left space-y-0.5 max-w-[38%]" dir="ltr">
                            <div className="text-xs font-bold leading-tight">
                              {printHeaderTitleEn || "Kingdom of Saudi Arabia"}
                            </div>
                            {(printHeaderSubtitleEn || "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin")
                              .split("\n")
                              .filter(Boolean)
                              .map((line, idx) => (
                                <div
                                  key={idx}
                                  className="text-[10px] font-semibold leading-tight text-slate-800"
                                >
                                  {line}
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="text-center mt-3">
                          <h2 className="text-xs font-extrabold uppercase tracking-wide underline decoration-1 underline-offset-2">
                            استمارة طلب وثيقة وبيانات الإقامة والجوازات
                          </h2>
                          <div className="text-[9px] font-bold text-slate-700 uppercase tracking-widest mt-0.5">
                            Official Document & Immigration Request Dossier
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Meta Info Bar */}
                    <div className="flex items-center justify-between text-[9px] mb-3 pb-1 border-b border-slate-200">
                      <div>
                        <span className="font-semibold">رقم الطلب (Doc Ref):</span>{" "}
                        <span className="font-mono font-bold">REQ-SAMPLE-01</span>
                      </div>
                      <div>
                        <span className="font-semibold">نوع الطلب (Type):</span>{" "}
                        <span>خطاب قيد (Letter of Enrollment)</span>
                      </div>
                      <div>
                        <span className="font-semibold">التاريخ (Date):</span>{" "}
                        <span className="font-mono">
                          {new Date().toLocaleDateString("en-CA")}
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Dummy Student Info */}
                    <div className="mb-3">
                      <div className="text-[9px] font-bold text-slate-800 uppercase tracking-wide mb-1 bg-slate-100 p-1 rounded">
                        1. بيانات الطالب مقدم الطلب (Student Information)
                      </div>
                      <table className="w-full border-collapse border border-slate-300 text-[9px]">
                        <tbody>
                          <tr>
                            <td className="border border-slate-300 px-1.5 py-1 font-semibold bg-slate-50 w-1/4">
                              اسم الطالب (Name)
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1">
                              عبدالرحمن محمد الشمري (Abdulrahman Al-Shammari)
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1 font-semibold bg-slate-50 w-1/4">
                              الرقم الجامعي (ID)
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1 font-mono">
                              441100234
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-slate-300 px-1.5 py-1 font-semibold bg-slate-50">
                              نوع الإقامة (Residency)
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1">
                              إقامة نظامية (IQOMAH)
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1 font-semibold bg-slate-50">
                              رقم الإقامة / الجواز
                            </td>
                            <td className="border border-slate-300 px-1.5 py-1 font-mono">
                              2458991204 / K984321
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Section 2: Dummy Request Details */}
                    <div className="mb-3">
                      <div className="text-[9px] font-bold text-slate-800 uppercase tracking-wide mb-1 bg-slate-100 p-1 rounded">
                        2. تفاصيل المعاملة والمرفقات (Request Details & Attachments)
                      </div>
                      <div className="border border-slate-200 rounded p-2 bg-slate-50/50 text-[9px] space-y-1">
                        <div>
                          <span className="font-semibold">الجهة الموجه إليها:</span> مصرف الراجحي (Bank)
                        </div>
                        <div>
                          <span className="font-semibold">لغة الخطاب:</span> العربية (Arabic)
                        </div>
                        <div>
                          <span className="font-semibold">طريقة الاستلام:</span> نسخة رقمية (Softcopy via app)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Signature Area & Footer */}
                  <div>
                    <div className="border-t-2 border-slate-800 pt-3">
                      <div className="text-[9px] font-bold text-slate-800 uppercase tracking-wide mb-3 text-center">
                        3. الاعتماد والتواقيع الرسمية (Official Approvals & Signatures)
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-center text-[9px]">
                        {/* Student Signature */}
                        <div className="space-y-6">
                          <div className="font-semibold">
                            توقيع الطالب مقدم الطلب
                            <span className="block text-[8px] text-slate-500 font-normal">
                              (Applicant Signature)
                            </span>
                          </div>
                          <div className="border-b border-slate-400 mx-3"></div>
                          <div className="text-[8px] text-slate-600">
                            عبدالرحمن محمد الشمري
                          </div>
                        </div>

                        {/* Supervisor Signature */}
                        <div className="space-y-6">
                          <div className="font-semibold">
                            مشرف الإسكان / شؤون الجوازات
                            <span className="block text-[8px] text-slate-500 font-normal">
                              (Housing Supervisor)
                            </span>
                          </div>
                          <div className="border-b border-slate-400 mx-3"></div>
                          <div className="text-[8px] font-semibold text-slate-800">
                            {printSignatureName ? (
                              <span>الاسم والتوقيع: {printSignatureName}</span>
                            ) : (
                              <span>الاسم والتوقيع: ...................................</span>
                            )}
                          </div>
                        </div>

                        {/* Official Stamp */}
                        <div className="space-y-2">
                          <div className="font-semibold">
                            الختم الرسمي والتاريخ
                            <span className="block text-[8px] text-slate-500 font-normal">
                              (Official Stamp)
                            </span>
                          </div>
                          <div className="w-14 h-14 mx-auto rounded-full border border-dashed border-slate-400 flex items-center justify-center text-[8px] text-slate-400">
                            ختم الإدارة
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Footer text */}
                    {printFooterText && (
                      <div className="mt-3 pt-1 border-t border-slate-200 text-center text-[8px] text-slate-500 italic">
                        {printFooterText}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="shrink-0 pt-3 border-t border-slate-100 flex items-center justify-between sm:justify-between w-full">
            <div className="text-xs text-muted-foreground hidden sm:block">
              {printSettingsTab === "editor" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrintSettingsTab("preview")}
                  className="text-xs gap-1 text-primary hover:text-primary"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>{t("tab_preview")}</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPrintSettingsTab("editor")}
                  className="text-xs gap-1 text-primary hover:text-primary"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>{t("tab_editor")}</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenPrintSettings(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="button"
                disabled={savingPrintSettings}
                onClick={savePrintSettings}
                data-testid="print-settings-save"
              >
                {savingPrintSettings ? t("updating") : t("save")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Staff/Admin Status Update Dialog ────────────────── */}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("update")}</DialogTitle>
          </DialogHeader>
          {edit && (
            <form onSubmit={submitEdit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t("status")}</Label>
                <Select
                  value={edit.status}
                  onValueChange={(v) => edit && setEdit({ ...edit, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Upload Result File (Softcopy Letter of Enrollment when COMPLETED) */}
              {edit.request_type === "letter_of_enrollment" &&
                edit.dynamic_data?.delivery_method === "softcopy" &&
                (edit.status || "").toLowerCase() === "completed" && (
                  <div
                    className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3"
                    data-testid="upload-result-file-section"
                  >
                    <Label className="flex items-center gap-1.5 text-xs font-semibold text-emerald-950">
                      <FileText className="h-4 w-4 text-emerald-700" />
                      <span>{t("upload_result_file")}</span>
                      <span className="text-red-500">*</span>
                    </Label>
                    <FileUpload
                      kind="result-letter"
                      accept=".pdf,application/pdf"
                      value={edit.result_file_id || null}
                      onChange={(id: string | null) =>
                        edit && setEdit({ ...edit, result_file_id: id })
                      }
                      label={t("upload_result_file")}
                    />
                    {!edit.result_file_id && (
                      <p className="text-[11px] text-amber-700 font-medium">
                        {lang === "ar"
                          ? "يجب رفع ملف الخطاب المعتمد بصيغة PDF لإتمام طلب النسخة الإلكترونية."
                          : "A finalized stamped/signed PDF letter must be uploaded before completing a softcopy request."}
                      </p>
                    )}
                  </div>
                )}

              <div className="space-y-1.5">
                <Label>{t("admin_note")}</Label>
                <Textarea
                  rows={3}
                  value={edit.admin_note || ""}
                  onChange={(e) =>
                    edit && setEdit({ ...edit, admin_note: e.target.value })
                  }
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEdit(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    saving ||
                    (edit.request_type === "letter_of_enrollment" &&
                      edit.dynamic_data?.delivery_method === "softcopy" &&
                      (edit.status || "").toLowerCase() === "completed" &&
                      !edit.result_file_id)
                  }
                  data-testid="doc-update-submit"
                >
                  {t("update")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Student: Edit Pending Document Request Dialog */}
      <EditDocumentRequest
        open={!!docToEdit}
        onOpenChange={(open) => !open && setDocToEdit(null)}
        document={docToEdit}
        studentProfile={studentProfile}
        systemSettings={systemSettings}
        onSuccess={load}
      />

      {/* Student: Cancel Document Request Confirmation Dialog */}
      <Dialog open={!!docToCancel} onOpenChange={(open) => !open && setDocToCancel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{t("confirm_cancel_request_title")}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600 leading-relaxed">
            {t("confirm_cancel_request_desc")}
            {docToCancel && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="font-semibold">{t("request_type")}:</span>{" "}
                  {t(docToCancel.request_type)}
                </div>
                <div>
                  <span className="font-semibold">{t("created_at")}:</span>{" "}
                  {new Date(docToCancel.created_at).toLocaleString()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={cancelling}
              onClick={() => setDocToCancel(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={handleCancelDocument}
              data-testid="confirm-cancel-doc-btn"
            >
              {cancelling ? t("updating") : t("confirm_cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Official A4 Printable Dossier Layout (@media print - Admin & Staff only) ── */}
      {printableDoc && isStaff && (
        <div className="hidden print:block fixed inset-0 bg-white p-8 z-[99999] text-black">
          {/* UoH Official Letterhead (Kop Surat Custom / Standard 3-Column) */}
          {systemSettings.print_layout_style === "custom_image" &&
          systemSettings.print_letterhead_url ? (
            <div className="border-b-2 border-slate-900 pb-3 mb-6">
              <img
                src={fileDownloadUrl(systemSettings.print_letterhead_url)}
                alt="University Letterhead"
                className="w-full max-h-28 object-contain mx-auto"
              />
              <div className="text-center mt-2">
                <h2 className="text-base font-extrabold uppercase tracking-wide underline decoration-1 underline-offset-4">
                  استمارة طلب وثيقة وبيانات الإقامة والجوازات
                </h2>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-widest mt-0.5">
                  Official Document & Immigration Request Dossier
                </div>
              </div>
            </div>
          ) : (
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex items-center justify-between gap-4">
                {/* Arabic Header */}
                <div className="text-right space-y-0.5 max-w-[40%]">
                  <div className="text-sm font-bold font-arabic">
                    {systemSettings.print_header_title_ar || "المملكة العربية السعودية"}
                  </div>
                  {(systemSettings.print_header_subtitle_ar ||
                    "وزارة التعليم\nجامعة حائل\nعمادة شؤون الطلاب · إدارة الإسكان الطلابي")
                    .split("\n")
                    .filter(Boolean)
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className="text-xs font-semibold font-arabic text-slate-800"
                      >
                        {line}
                      </div>
                    ))}
                </div>

                {/* Center Seal / Logo Placeholder */}
                <div className="text-center px-4 shrink-0">
                  {systemSettings.print_logo_url ? (
                    <img
                      src={fileDownloadUrl(systemSettings.print_logo_url)}
                      alt="University Logo"
                      className="w-16 h-16 object-contain mx-auto"
                    />
                  ) : (
                    <div className="w-16 h-16 mx-auto rounded-full border-2 border-slate-800 flex items-center justify-center font-bold text-lg text-slate-900">
                      UoH
                    </div>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700 mt-1">
                    University of Hail
                  </div>
                </div>

                {/* English Header */}
                <div className="text-left space-y-0.5 max-w-[40%]">
                  <div className="text-sm font-bold">
                    {systemSettings.print_header_title_en || "Kingdom of Saudi Arabia"}
                  </div>
                  {(systemSettings.print_header_subtitle_en ||
                    "Ministry of Education\nUniversity of Hail\nDeanship of Student Affairs · Housing Admin")
                    .split("\n")
                    .filter(Boolean)
                    .map((line, idx) => (
                      <div key={idx} className="text-xs font-semibold text-slate-800">
                        {line}
                      </div>
                    ))}
                </div>
              </div>

              <div className="text-center mt-4">
                <h2 className="text-base font-extrabold uppercase tracking-wide underline decoration-1 underline-offset-4">
                  استمارة طلب وثيقة وبيانات الإقامة والجوازات
                </h2>
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-widest mt-0.5">
                  Official Document & Immigration Request Dossier
                </div>
              </div>
            </div>
          )}

          {/* Document Reference Info */}
          <div className="flex items-center justify-between text-xs mb-4 pb-2 border-b border-slate-300">
            <div>
              <span className="font-semibold">رقم الطلب (Doc Ref):</span>{" "}
              <span className="font-mono">
                REQ-{printableDoc.doc.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            <div>
              <span className="font-semibold">نوع الطلب (Request Type):</span>{" "}
              <span className="font-bold">{t(printableDoc.doc.request_type)}</span>
            </div>
            <div>
              <span className="font-semibold">التاريخ (Date):</span>{" "}
              <span>{new Date(printableDoc.doc.created_at).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="font-semibold">الحالة (Status):</span>{" "}
              <span className="uppercase font-bold">{printableDoc.doc.status}</span>
            </div>
          </div>

          {/* Student Identity Data Table */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 bg-slate-100 p-1.5 border border-slate-300">
              1. بيانات الطالب والهوية (Student & Residency Data)
            </h3>
            <table className="w-full text-xs border border-slate-400 border-collapse">
              <tbody>
                <tr className="border-b border-slate-300">
                  <td className="p-2 bg-slate-50 font-semibold w-1/4 border-r border-slate-300">
                    الاسم الكامل (Full Name)
                  </td>
                  <td className="p-2 w-1/4 border-r border-slate-300">
                    {printableDoc.student?.arabicName ||
                      printableDoc.student?.englishName ||
                      printableDoc.student?.full_name ||
                      printableDoc.doc.user_name}
                  </td>
                  <td className="p-2 bg-slate-50 font-semibold w-1/4 border-r border-slate-300">
                    الرقم الجامعي (University ID)
                  </td>
                  <td className="p-2 w-1/4 font-mono">
                    {printableDoc.student?.universityId ||
                      printableDoc.student?.university_id ||
                      "—"}
                  </td>
                </tr>

                <tr className="border-b border-slate-300">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-300">
                    الجنسية (Nationality)
                  </td>
                  <td className="p-2 border-r border-slate-300">
                    {printableDoc.student?.nationality || "—"}
                  </td>
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-300">
                    رقم جواز السفر (Passport No)
                  </td>
                  <td className="p-2 font-mono">
                    {printableDoc.doc.request_type === "update_passport" &&
                    printableDoc.doc.dynamic_data?.new_passport_number
                      ? printableDoc.doc.dynamic_data.new_passport_number
                      : printableDoc.student?.passport_number ||
                        printableDoc.student?.passportNumber ||
                        "—"}{" "}
                    {printableDoc.student?.passport_expiry && (
                      <span className="text-[10px] text-slate-600 block">
                        Exp: {printableDoc.student.passport_expiry}
                      </span>
                    )}
                  </td>
                </tr>

                <tr className="border-b border-slate-300">
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-300">
                    نوع الهوية (Residency Type)
                  </td>
                  <td className="p-2 border-r border-slate-300 font-bold">
                    {(printableDoc.student?.residency_type ||
                      printableDoc.student?.residencyType) === "STUDENT_VISA"
                      ? "Student Visa (تأشيرة طالب)"
                      : "Iqomah (إقامة نظامية)"}
                  </td>
                  <td className="p-2 bg-slate-50 font-semibold border-r border-slate-300">
                    رقم الهوية (Identity Number)
                  </td>
                  <td className="p-2 font-mono">
                    {printableDoc.student?.residency_number ||
                      printableDoc.student?.residencyNumber ||
                      "—"}{" "}
                    {printableDoc.student?.residency_expiry && (
                      <span className="text-[10px] text-slate-600 block">
                        Exp: {printableDoc.student.residency_expiry}
                      </span>
                    )}
                  </td>
                </tr>

                {/* Additional row for Update Passport details */}
                {printableDoc.doc.request_type === "update_passport" &&
                  printableDoc.doc.dynamic_data && (
                    <tr className="border-b border-slate-300 bg-amber-50/40">
                      <td className="p-2 font-semibold border-r border-slate-300">
                        بيانات الجواز المحدث (New Passport Details)
                      </td>
                      <td colSpan={3} className="p-2">
                        <span className="font-bold">Passport:</span>{" "}
                        <span className="font-mono">
                          {printableDoc.doc.dynamic_data.new_passport_number}
                        </span>{" "}
                        | <span className="font-bold">Issue:</span>{" "}
                        <span className="font-mono">
                          {printableDoc.doc.dynamic_data.date_of_issue}
                        </span>{" "}
                        | <span className="font-bold">Expiry:</span>{" "}
                        <span className="font-mono">
                          {printableDoc.doc.dynamic_data.date_of_expiry}
                        </span>{" "}
                        | <span className="font-bold">Office:</span>{" "}
                        <span>{printableDoc.doc.dynamic_data.issuing_office}</span>
                      </td>
                    </tr>
                  )}

                {/* Flight Ticket Details */}
                {printableDoc.doc.dynamic_data?.destination && (
                  <tr className="border-b border-slate-300 bg-sky-50/40">
                    <td className="p-2 font-semibold border-r border-slate-300">
                      بيانات التذكرة (Flight Ticket)
                    </td>
                    <td colSpan={3} className="p-2">
                      <span className="font-bold">Route:</span> Hail (HAS) ➔{" "}
                      {printableDoc.doc.dynamic_data.destination} |{" "}
                      <span className="font-bold">Type:</span>{" "}
                      {printableDoc.doc.dynamic_data.trip_type === "round_trip"
                        ? "Round Trip (ذهاب وعودة)"
                        : "One Way (ذهاب فقط)"}{" "}
                      | <span className="font-bold">Departure:</span>{" "}
                      <span className="font-mono">
                        {printableDoc.doc.dynamic_data.departure_date}
                      </span>
                      {printableDoc.doc.dynamic_data.trip_type === "round_trip" &&
                        printableDoc.doc.dynamic_data.return_date && (
                          <>
                            {" "}
                            | <span className="font-bold">Return:</span>{" "}
                            <span className="font-mono">
                              {printableDoc.doc.dynamic_data.return_date}
                            </span>
                          </>
                        )}
                    </td>
                  </tr>
                )}

                {/* Exit/Re-entry Visa Validity Details */}
                {printableDoc.doc.request_type === "exit_reentry_visa" &&
                  printableDoc.doc.dynamic_data?.visa_validity_type && (
                    <tr className="border-b border-slate-300 bg-purple-50/40">
                      <td className="p-2 font-semibold border-r border-slate-300">
                        صلاحية التأشيرة (Visa Validity)
                      </td>
                      <td colSpan={3} className="p-2">
                        <span className="font-bold">Type:</span>{" "}
                        {printableDoc.doc.dynamic_data.visa_validity_type === "return_before"
                          ? "Return To KSA Before (العودة للمملكة قبل)"
                          : "Duration in Days (المدة بالأيام)"}{" "}
                        | <span className="font-bold">Value:</span>{" "}
                        <span className="font-mono font-bold">
                          {printableDoc.doc.dynamic_data.visa_validity_type === "return_before"
                            ? printableDoc.doc.dynamic_data.return_to_ksa_before
                            : `${printableDoc.doc.dynamic_data.duration_days} Days`}
                        </span>
                        {printableDoc.doc.dynamic_data.resident_id_expiry && (
                          <>
                            {" "}
                            | <span className="font-bold">Iqomah Expiry Ref:</span>{" "}
                            <span className="font-mono">
                              {printableDoc.doc.dynamic_data.resident_id_expiry}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  )}

                {/* Letter of Enrollment Details */}
                {printableDoc.doc.request_type === "letter_of_enrollment" &&
                  printableDoc.doc.dynamic_data?.addressed_to && (
                    <tr className="border-b border-slate-300 bg-emerald-50/40">
                      <td className="p-2 font-semibold border-r border-slate-300">
                        بيانات خطاب القيد (Letter Details)
                      </td>
                      <td colSpan={3} className="p-2">
                        <span className="font-bold">جهة التوجيه (Addressed To):</span>{" "}
                        <span className="font-medium">
                          {printableDoc.doc.dynamic_data.addressed_to === "Other"
                            ? printableDoc.doc.dynamic_data.addressed_to_other || "Other"
                            : printableDoc.doc.dynamic_data.addressed_to}
                        </span>{" "}
                        | <span className="font-bold">اللغة (Language):</span>{" "}
                        <span>
                          {printableDoc.doc.dynamic_data.letter_language === "ar"
                            ? "العربية (Arabic)"
                            : "الإنجليزية (English)"}
                        </span>{" "}
                        | <span className="font-bold">طريقة الاستلام (Delivery):</span>{" "}
                        <span>
                          {printableDoc.doc.dynamic_data.delivery_method === "softcopy"
                            ? "نسخة إلكترونية (Softcopy PDF)"
                            : "نسخة ورقية مختومة (Hardcopy Pick up)"}
                        </span>
                      </td>
                    </tr>
                  )}

                {printableDoc.doc.notes && (
                  <tr>
                    <td className="p-2 bg-slate-50 font-semibold border-r border-slate-300">
                      الملاحظات (Notes)
                    </td>
                    <td colSpan={3} className="p-2">
                      {printableDoc.doc.notes}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Render Documents Side-by-side for Physical Print Verification */}
          <div className="mb-8">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 bg-slate-100 p-1.5 border border-slate-300">
              2. صور المستندات الرسمية المرفقة (Attached Official Document Scans)
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Passport Copy */}
              <div className="border border-slate-300 p-3 rounded text-center">
                <div className="text-[11px] font-bold text-slate-800 mb-2 pb-1 border-b border-slate-200">
                  {printableDoc.doc.request_type === "update_passport" &&
                  printableDoc.doc.dynamic_data?.passport_file
                    ? "صورة جواز السفر الجديد (New Passport Scan)"
                    : "صورة جواز السفر (Passport Scan)"}
                </div>
                {printableDoc.doc.request_type === "update_passport" &&
                printableDoc.doc.dynamic_data?.passport_file ? (
                  <img
                    src={fileDownloadUrl(
                      printableDoc.doc.dynamic_data.passport_file
                    )}
                    alt="New Passport Scan"
                    className="max-h-48 max-w-full mx-auto object-contain rounded border border-slate-200"
                  />
                ) : printableDoc.student?.passport_file_id ? (
                  <img
                    src={fileDownloadUrl(printableDoc.student.passport_file_id)}
                    alt="Passport Scan"
                    className="max-h-48 max-w-full mx-auto object-contain rounded border border-slate-200"
                  />
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500 border border-dashed rounded">
                    لم يتم إرفاق ملف جواز السفر
                  </div>
                )}
              </div>

              {/* Residency / Visa Copy */}
              <div className="border border-slate-300 p-3 rounded text-center">
                <div className="text-[11px] font-bold text-slate-800 mb-2 pb-1 border-b border-slate-200">
                  {(printableDoc.student?.residency_type ||
                    printableDoc.student?.residencyType) === "STUDENT_VISA"
                    ? "صورة تأشيرة الطالب (Student Visa Scan)"
                    : "صورة هوية الإقامة (Iqomah Scan)"}
                </div>
                {printableDoc.student?.residency_file_id ||
                printableDoc.student?.iqomah_file_id ? (
                  <img
                    src={fileDownloadUrl(
                      printableDoc.student.residency_file_id ||
                        printableDoc.student.iqomah_file_id!
                    )}
                    alt="Residency Document Scan"
                    className="max-h-48 max-w-full mx-auto object-contain rounded border border-slate-200"
                  />
                ) : (
                  <div className="h-32 flex items-center justify-center text-xs text-slate-500 border border-dashed rounded">
                    لم يتم إرفاق ملف الإقامة / التأشيرة
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Official Signature Area (Kolom Tanda Tangan Musyrif/Admin & Mahasiswa) */}
          <div className="mt-8 pt-4 border-t-2 border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-4 text-center">
              3. الاعتماد والتواقيع الرسمية (Official Approvals & Signatures)
            </h3>
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              {/* 1. Student Signature */}
              <div className="space-y-12">
                <div className="font-semibold text-slate-800">
                  توقيع الطالب مقدم الطلب
                  <span className="block text-[10px] text-slate-600 font-normal">
                    (Applicant Student Signature)
                  </span>
                </div>
                <div className="border-b border-slate-400 mx-4"></div>
                <div className="text-[11px] font-medium text-slate-700">
                  {printableDoc.student?.arabicName ||
                    printableDoc.student?.englishName ||
                    printableDoc.doc.user_name}
                </div>
              </div>

              {/* 2. Housing Supervisor Signature */}
              <div className="space-y-12">
                <div className="font-semibold text-slate-800">
                  مشرف الإسكان / شؤون الجوازات
                  <span className="block text-[10px] text-slate-600 font-normal">
                    (Housing / Immigration Supervisor)
                  </span>
                </div>
                <div className="border-b border-slate-400 mx-4"></div>
                <div className="text-[11px] font-medium text-slate-700">
                  {systemSettings.print_signature_name ? (
                    <span>الاسم والتوقيع: {systemSettings.print_signature_name}</span>
                  ) : (
                    <span>الاسم والتوقيع: ...................................</span>
                  )}
                </div>
              </div>

              {/* 3. Official Stamp */}
              <div className="space-y-4">
                <div className="font-semibold text-slate-800">
                  الختم الرسمي والتاريخ
                  <span className="block text-[10px] text-slate-600 font-normal">
                    (Official Stamp & Date)
                  </span>
                </div>
                <div className="w-24 h-24 mx-auto rounded-full border-2 border-dashed border-slate-400 flex items-center justify-center text-[10px] text-slate-400">
                  ختم الإدارة
                </div>
              </div>
            </div>
          </div>

          {/* Optional Footer Text */}
          {systemSettings.print_footer_text && (
            <div className="mt-8 pt-2 border-t border-slate-300 text-center text-[10px] text-slate-600 italic">
              {systemSettings.print_footer_text}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Document Preview Card (Passport & Residency Render) ─────────
function DocumentPreviewCard({
  fileId,
  title,
  subtitle,
}: {
  fileId: string | null;
  title: string;
  subtitle?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
        <div>
          <span className="text-xs font-bold text-slate-800 block truncate">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] font-mono text-muted-foreground block truncate">
              {subtitle}
            </span>
          )}
        </div>
        {fileId && (
          <FileViewButton
            fileId={fileId}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 shrink-0"
          >
            <Eye className="h-3 w-3" />
            <span>{t("view")}</span>
          </FileViewButton>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center min-h-[160px] bg-slate-50/80 rounded-md overflow-hidden border border-slate-100 p-2">
        {fileId ? (
          <FileViewButton fileId={fileId} className="w-full h-full">
            <div className="relative group w-full h-full flex items-center justify-center cursor-pointer">
              <img
                src={fileDownloadUrl(fileId)}
                alt={title}
                className="max-h-40 max-w-full object-contain rounded transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded transition-opacity text-white text-xs font-semibold gap-1.5">
                <Eye className="h-4 w-4" />
                {t("view")}
              </div>
            </div>
          </FileViewButton>
        ) : (
          <div className="text-center p-4 text-xs text-muted-foreground">
            <FileText className="h-6 w-6 mx-auto mb-1 opacity-40" />
            {t("no_data")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Attachment Pill Component ──────────────────────────────────
function AttachmentPill({ fileId }: { fileId: string }) {
  const [meta, setMeta] = useState<{ original_filename: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api
      .get(`/files/${fileId}`)
      .then((r) => {
        if (!cancelled) setMeta(r.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const name = meta?.original_filename || "file";
  return (
    <FileViewButton
      fileId={fileId}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors"
      testid={`attachment-${fileId}`}
    >
      <Paperclip className="h-3 w-3 text-primary" />
      <span className="truncate max-w-[180px]">{name}</span>
      <Eye className="h-3 w-3 text-muted-foreground" />
    </FileViewButton>
  );
}
