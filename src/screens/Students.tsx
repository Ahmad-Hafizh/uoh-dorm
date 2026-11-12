"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COUNTRIES, getCountryLabel } from "@/constants/countries";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Trash2, Pencil, CheckCircle2, AlertCircle, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import FileUpload from "@/components/FileUpload";
import { FileThumb } from "@/components/FilePreview";

export type ResidenceStatus = "INSIDE_SAKAN" | "OUTSIDE_SAKAN";
export type AcademicStatus = "ACTIVE" | "ON_LEAVE";
export type SortField =
  | "name"
  | "universityId"
  | "nationality"
  | "academicStatus"
  | "residenceStatus"
  | "program"
  | "iqomah_expiry";
export type SortOrder = "asc" | "desc";

export interface Student {
  id: string;
  arabicName?: string;
  englishName?: string;
  full_name?: string;
  universityId?: string | number;
  arrivalDate?: string | null;
  programStudy?: string;
  academicYear?: string;
  residenceStatus?: ResidenceStatus;
  room_number?: string | null;
  address?: string | null;
  academicStatus?: AcademicStatus;
  adminNotes?: string | null;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  iqomah_number: string;
  iqomah_expiry: string;
  phone: string;
  building?: string;
  program?: string;
  academic_year?: string;
  passport_file_id: string | null;
  iqomah_file_id: string | null;
}

export interface StudyProgram {
  id: string;
  name_ar: string;
  name_en: string;
  created_at?: string;
}

type StudentForm = Omit<Student, "id"> & {
  email: string;
  password?: string;
};

const EMPTY: StudentForm = {
  email: "",
  password: "",
  arabicName: "",
  englishName: "",
  full_name: "",
  universityId: "",
  arrivalDate: "",
  programStudy: "",
  academicYear: "2026/2027",
  residenceStatus: "INSIDE_SAKAN",
  room_number: "",
  address: "",
  academicStatus: "ACTIVE",
  adminNotes: "",
  nationality: "",
  passport_number: "",
  passport_expiry: "",
  iqomah_number: "",
  iqomah_expiry: "",
  phone: "",
  passport_file_id: null,
  iqomah_file_id: null,
};

export default function Students() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(EMPTY);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  // Quick residence status change modal
  const [residenceModalOpen, setResidenceModalOpen] = useState(false);
  const [selectedStudentForResidence, setSelectedStudentForResidence] = useState<Student | null>(null);
  const [residenceFormStatus, setResidenceFormStatus] = useState<ResidenceStatus>("INSIDE_SAKAN");
  const [residenceFormRoom, setResidenceFormRoom] = useState("");
  const [residenceFormAddress, setResidenceFormAddress] = useState("");
  const [savingResidence, setSavingResidence] = useState(false);

  // Study Programs State & Admin Management
  const [programs, setPrograms] = useState<StudyProgram[]>([]);
  const [programsModalOpen, setProgramsModalOpen] = useState(false);
  const [programFormOpen, setProgramFormOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<StudyProgram | null>(null);
  const [programForm, setProgramForm] = useState({ name_ar: "", name_en: "" });
  const [savingProgram, setSavingProgram] = useState(false);
  const [programSearch, setProgramSearch] = useState("");

  const reloadPrograms = async () => {
    try {
      const { data } = await api.get("/programs");
      setPrograms(Array.isArray(data) ? data : []);
    } catch {}
  };

  const load = async () => {
    try {
      const [{ data: studentsData }, { data: programsData }] = await Promise.all([
        api.get("/students"),
        api.get("/programs").catch(() => ({ data: [] })),
      ]);
      setRows(studentsData);
      setPrograms(Array.isArray(programsData) ? programsData : []);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNewProgram = () => {
    setEditingProgram(null);
    setProgramForm({ name_ar: "", name_en: "" });
    setProgramFormOpen(true);
  };

  const openEditProgram = (prog: StudyProgram) => {
    setEditingProgram(prog);
    setProgramForm({ name_ar: prog.name_ar, name_en: prog.name_en });
    setProgramFormOpen(true);
  };

  const saveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.name_ar.trim() || !programForm.name_en.trim()) {
      toast.error(lang === "ar" ? "يرجى إدخال اسم البرنامج بالعربية والإنجليزية" : "Please provide both Arabic and English names");
      return;
    }
    setSavingProgram(true);
    try {
      if (editingProgram) {
        await api.patch(`/programs/${editingProgram.id}`, programForm);
        toast.success(t("program_updated"));
      } else {
        await api.post("/programs", programForm);
        toast.success(t("program_added"));
      }
      setProgramFormOpen(false);
      setEditingProgram(null);
      setProgramForm({ name_ar: "", name_en: "" });
      await reloadPrograms();
    } catch (err) {
      toast.error(formatApiError(axios.isAxiosError(err) ? err.response?.data?.detail : undefined));
    } finally {
      setSavingProgram(false);
    }
  };

  const deleteProgram = async (prog: StudyProgram) => {
    if (!confirm(t("confirm_delete_program"))) return;
    try {
      await api.delete(`/programs/${prog.id}`);
      toast.success(t("program_deleted"));
      await reloadPrograms();
    } catch (err) {
      toast.error(formatApiError(axios.isAxiosError(err) ? err.response?.data?.detail : undefined));
    }
  };

  const getProgramDisplay = (val?: string) => {
    if (!val) return "—";
    const found = programs.find(
      (p) => p.id === val || p.name_ar === val || p.name_en === val
    );
    if (!found) return val;
    return lang === "ar" ? found.name_ar : found.name_en;
  };

  const openNew = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      programStudy: programs[0]?.name_ar || "",
    });
    setOpen(true);
  };

  const openEdit = (r: Student) => {
    setEditing(r);
    const rawProg = r.programStudy || r.program || "";
    const matched = programs.find(
      (p) => p.id === rawProg || p.name_ar === rawProg || p.name_en === rawProg
    );
    const resolvedProgram = matched ? matched.name_ar : rawProg;

    setForm({
      email: "",
      password: "",
      arabicName: r.arabicName || r.full_name || "",
      englishName: r.englishName || r.full_name || "",
      full_name: r.full_name || r.englishName || r.arabicName || "",
      universityId: r.universityId || "",
      arrivalDate: r.arrivalDate ? String(r.arrivalDate).split("T")[0] : "",
      programStudy: resolvedProgram,
      academicYear: r.academicYear || r.academic_year || "2026/2027",
      residenceStatus: r.residenceStatus || "INSIDE_SAKAN",
      room_number: r.room_number || "",
      address: r.address || "",
      academicStatus: r.academicStatus || "ACTIVE",
      adminNotes: r.adminNotes || "",
      nationality: r.nationality || "",
      passport_number: r.passport_number || "",
      passport_expiry: r.passport_expiry ? String(r.passport_expiry).split("T")[0] : "",
      iqomah_number: r.iqomah_number || "",
      iqomah_expiry: r.iqomah_expiry ? String(r.iqomah_expiry).split("T")[0] : "",
      phone: r.phone || "",
      passport_file_id: r.passport_file_id || null,
      iqomah_file_id: r.iqomah_file_id || null,
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        full_name: form.englishName || form.arabicName || form.full_name,
        program: form.programStudy,
        academic_year: form.academicYear,
      };

      if (editing) {
        const { password, email, ...updates } = payload;
        await api.patch(`/students/${editing.id}`, updates);
        toast.success(lang === "ar" ? "تم تحديث بيانات الطالب بنجاح" : "Student updated successfully");
      } else {
        await api.post("/students", payload);
        toast.success(lang === "ar" ? "تمت إضافة الطالب بنجاح" : "Student created successfully");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!window.confirm(lang === "ar" ? "هل أنت متأكد من حذف هذا الطالب؟" : "Delete student?")) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success(lang === "ar" ? "تم حذف الطالب" : "Deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  // Quick change academic status
  const updateAcademicStatus = async (student: Student, newStatus: AcademicStatus) => {
    try {
      await api.patch(`/students/${student.id}`, { academicStatus: newStatus });
      setRows((prev) =>
        prev.map((r) => (r.id === student.id ? { ...r, academicStatus: newStatus } : r))
      );
      toast.success(
        lang === "ar"
          ? `تم تحديث الحالة الأكاديمية إلى: ${newStatus === "ACTIVE" ? "منتظم" : "مجاز / مؤجل"}`
          : `Academic status updated to ${newStatus === "ACTIVE" ? "Active" : "On Leave"}`
      );
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  // Quick change residence status modal
  const openResidenceModal = (student: Student) => {
    setSelectedStudentForResidence(student);
    setResidenceFormStatus(student.residenceStatus || "INSIDE_SAKAN");
    setResidenceFormRoom(student.room_number || "");
    setResidenceFormAddress(student.address || "");
    setResidenceModalOpen(true);
  };

  const saveResidenceStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForResidence) return;
    setSavingResidence(true);
    try {
      const updates = {
        residenceStatus: residenceFormStatus,
        room_number: residenceFormStatus === "INSIDE_SAKAN" ? residenceFormRoom : null,
        address: residenceFormStatus === "OUTSIDE_SAKAN" ? residenceFormAddress : null,
      };
      await api.patch(`/students/${selectedStudentForResidence.id}`, updates);
      setRows((prev) =>
        prev.map((r) =>
          r.id === selectedStudentForResidence.id ? { ...r, ...updates } : r
        )
      );
      toast.success(
        lang === "ar"
          ? `تم تحديث حالة السكن إلى: ${residenceFormStatus === "INSIDE_SAKAN" ? "داخل السكن" : "خارج السكن"}`
          : `Residence status updated to ${residenceFormStatus === "INSIDE_SAKAN" ? "Inside Dorm" : "Outside Dorm"}`
      );
      setResidenceModalOpen(false);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSavingResidence(false);
    }
  };

  const searchLower = search.toLowerCase();
  const bySearch = rows.filter((r) => {
    const arabic = r.arabicName || "";
    const english = r.englishName || "";
    const full = r.full_name || "";
    const univId = String(r.universityId || "");
    const nat = r.nationality || "";
    const room = r.room_number || "";
    const addr = r.address || "";
    const iqamah = r.iqomah_number || "";
    const pass = r.passport_number || "";
    return (
      (arabic + " " + english + " " + full + " " + univId + " " + nat + " " + room + " " + addr + " " + iqamah + " " + pass)
        .toLowerCase()
        .includes(searchLower)
    );
  });

  const counts = {
    all: bySearch.length,
    active: bySearch.filter((r) => (r.academicStatus || "ACTIVE") === "ACTIVE").length,
    on_leave: bySearch.filter((r) => r.academicStatus === "ON_LEAVE").length,
    inside_sakan: bySearch.filter((r) => (r.residenceStatus || "INSIDE_SAKAN") === "INSIDE_SAKAN").length,
    outside_sakan: bySearch.filter((r) => r.residenceStatus === "OUTSIDE_SAKAN").length,
    missing_passport: bySearch.filter((r) => !r.passport_file_id).length,
    missing_iqomah: bySearch.filter((r) => !r.iqomah_file_id).length,
    missing_any: bySearch.filter((r) => !r.passport_file_id || !r.iqomah_file_id).length,
  };

  const filtered = bySearch.filter((r) => {
    if (tab === "active") return (r.academicStatus || "ACTIVE") === "ACTIVE";
    if (tab === "on_leave") return r.academicStatus === "ON_LEAVE";
    if (tab === "inside_sakan") return (r.residenceStatus || "INSIDE_SAKAN") === "INSIDE_SAKAN";
    if (tab === "outside_sakan") return r.residenceStatus === "OUTSIDE_SAKAN";
    if (tab === "missing_passport") return !r.passport_file_id;
    if (tab === "missing_iqomah") return !r.iqomah_file_id;
    if (tab === "missing_any") return !r.passport_file_id || !r.iqomah_file_id;
    return true;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sorted = [...filtered].sort((a, b) => {
    let valA = "";
    let valB = "";

    switch (sortField) {
      case "name":
        valA = (lang === "ar" ? (a.arabicName || a.full_name) : (a.englishName || a.full_name)) || "";
        valB = (lang === "ar" ? (b.arabicName || b.full_name) : (b.englishName || b.full_name)) || "";
        break;
      case "universityId":
        valA = String(a.universityId || "");
        valB = String(b.universityId || "");
        break;
      case "nationality":
        valA = getCountryLabel(a.nationality, lang) || a.nationality || "";
        valB = getCountryLabel(b.nationality, lang) || b.nationality || "";
        break;
      case "academicStatus":
        valA = a.academicStatus || "ACTIVE";
        valB = b.academicStatus || "ACTIVE";
        break;
      case "residenceStatus":
        valA = (a.residenceStatus || "INSIDE_SAKAN") + (a.room_number || a.address || "");
        valB = (b.residenceStatus || "INSIDE_SAKAN") + (b.room_number || b.address || "");
        break;
      case "program":
        valA = getProgramDisplay(a.programStudy || a.program);
        valB = getProgramDisplay(b.programStudy || b.program);
        break;
      case "iqomah_expiry":
        valA = a.iqomah_expiry || "";
        valB = b.iqomah_expiry || "";
        break;
    }

    const comparison = valA.localeCompare(valB, lang === "ar" ? "ar" : "en", {
      numeric: true,
      sensitivity: "base",
    });
    return sortOrder === "asc" ? comparison : -comparison;
  });

  const isAdmin = Boolean(user && (user.role === "admin" || (user.role as string).toUpperCase() === "ADMIN"));
  const canDelete = isAdmin;

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("students")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length} {t("students").toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setProgramsModalOpen(true)}
              className="gap-2"
              data-testid="manage-programs-btn"
            >
              <GraduationCap className="h-4 w-4 text-indigo-600" />
              {t("manage_programs")}
            </Button>
          )}

          {/* Add / Edit Student Dialog */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2" data-testid="add-student-btn">
                <Plus className="h-4 w-4" /> {t("add_student")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? t("edit") : t("add_student")}</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 pt-2" data-testid="student-form">
                {!editing && (
                  <>
                  <Field
                    label={t("email")}
                    required
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    type="email"
                  />
                  <Field
                    label={t("password")}
                    required
                    value={form.password || ""}
                    onChange={(v) => setForm({ ...form, password: v })}
                    type="password"
                  />
                </>
              )}

              {/* Arabic Name & English Name */}
              <Field
                label={lang === "ar" ? "الاسم بالعربي" : t("arabic_name")}
                required
                value={form.arabicName || ""}
                onChange={(v) => setForm({ ...form, arabicName: v })}
              />
              <Field
                label={lang === "ar" ? "الاسم بالإنجليزية" : t("english_name")}
                required
                value={form.englishName || ""}
                onChange={(v) => setForm({ ...form, englishName: v })}
              />

              {/* University ID & Arrival Date */}
              <Field
                label={lang === "ar" ? "الرقم الجامعي" : t("university_id")}
                required
                value={String(form.universityId || "")}
                onChange={(v) => setForm({ ...form, universityId: v })}
              />
              <Field
                label={lang === "ar" ? "تاريخ الوصول" : t("arrival_date")}
                type="date"
                value={form.arrivalDate || ""}
                onChange={(v) => setForm({ ...form, arrivalDate: v })}
              />

              {/* Academic Status Select */}
              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "ar" ? "الحالة الأكاديمية" : t("academic_status")}</Label>
                <Select
                  value={form.academicStatus || "ACTIVE"}
                  onValueChange={(v) => setForm({ ...form, academicStatus: v as AcademicStatus })}
                >
                  <SelectTrigger data-testid="academic-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">
                      {lang === "ar" ? "منتظم (Active)" : t("status_active")}
                    </SelectItem>
                    <SelectItem value="ON_LEAVE">
                      {lang === "ar" ? "مجاز / مؤجل (On Leave)" : t("status_on_leave")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Residence Status Select */}
              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "ar" ? "حالة السكن" : t("residence_status")}</Label>
                <Select
                  value={form.residenceStatus || "INSIDE_SAKAN"}
                  onValueChange={(v) => setForm({ ...form, residenceStatus: v as ResidenceStatus })}
                >
                  <SelectTrigger data-testid="residence-status-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSIDE_SAKAN">
                      {lang === "ar" ? "داخل السكن (Inside Dorm)" : t("inside_sakan")}
                    </SelectItem>
                    <SelectItem value="OUTSIDE_SAKAN">
                      {lang === "ar" ? "خارج السكن (Outside Dorm)" : t("outside_sakan")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Conditional: Room Number vs Address */}
              {form.residenceStatus === "INSIDE_SAKAN" ? (
                <Field
                  label={lang === "ar" ? "رقم الغرفة" : t("room_number")}
                  required
                  value={form.room_number || ""}
                  onChange={(v) => setForm({ ...form, room_number: v })}
                />
              ) : (
                <Field
                  label={lang === "ar" ? "عنوان السكن" : t("residence_address")}
                  required
                  value={form.address || ""}
                  onChange={(v) => setForm({ ...form, address: v })}
                />
              )}

              {/* Nationality */}
              <div className="space-y-1.5">
                <Label className="text-xs">{t("nationality")}</Label>
                <Select
                  value={form.nationality || ""}
                  onValueChange={(v) => setForm({ ...form, nationality: v })}
                >
                  <SelectTrigger data-testid="nationality-select">
                    <SelectValue placeholder="—">
                      {form.nationality ? getCountryLabel(form.nationality, lang) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.en} value={c.en}>
                        {lang === "ar" ? c.ar : c.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Academic Program & Year */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {lang === "ar" ? "البرنامج الأكاديمي" : t("program")}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.programStudy || ""}
                  onValueChange={(v) => setForm({ ...form, programStudy: v })}
                >
                  <SelectTrigger className="w-full text-xs bg-white" data-testid="program-select">
                    <SelectValue placeholder={t("select_program")}>
                      {form.programStudy ? getProgramDisplay(form.programStudy) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {programs.map((p) => {
                      const primary = lang === "ar" ? p.name_ar : p.name_en;
                      const secondary = lang === "ar" ? p.name_en : p.name_ar;
                      return (
                        <SelectItem key={p.id} value={p.name_ar}>
                          <span>{primary}</span>
                          {secondary && (
                            <span className="text-muted-foreground text-[11px] ms-1.5 opacity-70">
                              ({secondary})
                            </span>
                          )}
                        </SelectItem>
                      );
                    })}
                    {form.programStudy &&
                      !programs.some((p) => p.name_ar === form.programStudy) && (
                        <SelectItem value={form.programStudy}>
                          {form.programStudy}
                        </SelectItem>
                      )}
                  </SelectContent>
                </Select>
              </div>
              <Field
                label={lang === "ar" ? "السنة الدراسية" : t("academic_year")}
                required
                value={form.academicYear || ""}
                onChange={(v) => setForm({ ...form, academicYear: v })}
              />

              {/* Phone & ID Details */}
              <Field
                label={t("phone")}
                required
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
              <Field
                label={t("passport")}
                required
                value={form.passport_number}
                onChange={(v) => setForm({ ...form, passport_number: v })}
              />
              <Field
                label={t("passport_expiry")}
                type="date"
                required
                value={form.passport_expiry}
                onChange={(v) => setForm({ ...form, passport_expiry: v })}
              />
              <Field
                label={t("iqomah_number")}
                required
                value={form.iqomah_number}
                onChange={(v) => setForm({ ...form, iqomah_number: v })}
              />
              <Field
                label={t("iqomah_expiry")}
                type="date"
                required
                value={form.iqomah_expiry}
                onChange={(v) => setForm({ ...form, iqomah_expiry: v })}
              />

              {/* Admin Notes */}
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs">{lang === "ar" ? "ملاحظات الإدارة" : t("admin_notes")}</Label>
                <Input
                  value={form.adminNotes || ""}
                  onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                  placeholder={lang === "ar" ? "ملاحظات إدارية خاصة بالطالب…" : "Admin notes..."}
                />
              </div>

              {/* Document Scans */}
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("passport_file")}</Label>
                  <FileUpload
                    kind="passport"
                    value={form.passport_file_id}
                    onChange={(id: string | null) => setForm({ ...form, passport_file_id: id })}
                    label={t("upload")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("iqomah_file")}</Label>
                  <FileUpload
                    kind="iqomah"
                    value={form.iqomah_file_id}
                    onChange={(id: string | null) => setForm({ ...form, iqomah_file_id: id })}
                    label={t("upload")}
                  />
                </div>
              </div>

              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={saving} data-testid="student-submit">
                  {saving ? "…" : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Filter Tabs, Search & Sort Toolbar */}
      <div className="flex flex-col gap-3">
        <Tabs value={tab} onValueChange={setTab} data-testid="students-filter">
          <TabsList className="bg-slate-100 h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="all" className="gap-1.5" data-testid="tab-all">
              {t("all")}
              <span className="text-[10px] rounded-full bg-white px-1.5 py-0.5 tabular-nums font-semibold text-slate-600">
                {counts.all}
              </span>
            </TabsTrigger>
            <TabsTrigger value="active" className="gap-1.5" data-testid="tab-active">
              {lang === "ar" ? "منتظمون" : t("active_students")}
              <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-800 px-1.5 py-0.5 tabular-nums font-semibold">
                {counts.active}
              </span>
            </TabsTrigger>
            <TabsTrigger value="on_leave" className="gap-1.5" data-testid="tab-on-leave">
              {lang === "ar" ? "مجازون / مؤجلون" : t("on_leave_students")}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 tabular-nums font-semibold ${counts.on_leave ? "bg-amber-100 text-amber-800" : "bg-white text-slate-600"}`}>
                {counts.on_leave}
              </span>
            </TabsTrigger>
            <TabsTrigger value="inside_sakan" className="gap-1.5" data-testid="tab-inside-sakan">
              {lang === "ar" ? "داخل السكن" : t("inside_sakan")}
              <span className="text-[10px] rounded-full bg-white px-1.5 py-0.5 tabular-nums font-semibold text-slate-600">
                {counts.inside_sakan}
              </span>
            </TabsTrigger>
            <TabsTrigger value="outside_sakan" className="gap-1.5" data-testid="tab-outside-sakan">
              {lang === "ar" ? "خارج السكن" : t("outside_sakan")}
              <span className="text-[10px] rounded-full bg-white px-1.5 py-0.5 tabular-nums font-semibold text-slate-600">
                {counts.outside_sakan}
              </span>
            </TabsTrigger>
            <TabsTrigger value="missing_any" className="gap-1.5" data-testid="tab-missing-any">
              {t("missing_docs")}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 tabular-nums font-semibold ${counts.missing_any ? "bg-red-100 text-red-800" : "bg-white text-slate-600"}`}>
                {counts.missing_any}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
              data-testid="student-search"
            />
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {lang === "ar" ? "ترتيب حسب:" : t("sort_by") + ":"}
            </span>
            <Select
              value={`${sortField}-${sortOrder}`}
              onValueChange={(val) => {
                const [f, o] = val.split("-") as [SortField, SortOrder];
                setSortField(f);
                setSortOrder(o);
              }}
            >
              <SelectTrigger className="w-[200px] h-9 text-xs" data-testid="sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="name-asc">{lang === "ar" ? "الاسم (أ – ي)" : t("sort_name_asc")}</SelectItem>
                <SelectItem value="name-desc">{lang === "ar" ? "الاسم (ي – أ)" : t("sort_name_desc")}</SelectItem>
                <SelectItem value="universityId-asc">{lang === "ar" ? "الرقم الجامعي" : t("sort_id_asc")}</SelectItem>
                <SelectItem value="nationality-asc">{lang === "ar" ? "الجنسية" : t("nationality")}</SelectItem>
                <SelectItem value="academicStatus-asc">{lang === "ar" ? "الحالة الأكاديمية" : t("sort_status")}</SelectItem>
                <SelectItem value="residenceStatus-asc">{lang === "ar" ? "حالة السكن" : t("sort_residence")}</SelectItem>
                <SelectItem value="program-asc">{lang === "ar" ? "البرنامج الأكاديمي" : t("program")}</SelectItem>
                <SelectItem value="iqomah_expiry-asc">{lang === "ar" ? "انتهاء الإقامة (الأقرب)" : t("sort_iqomah_asc")}</SelectItem>
                <SelectItem value="iqomah_expiry-desc">{lang === "ar" ? "انتهاء الإقامة (الأبعد)" : t("sort_iqomah_desc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Students Data Table */}
      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <SortHeader
                  label={lang === "ar" ? "الطالب" : t("student")}
                  field="name"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label={t("nationality")}
                  field="nationality"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label={lang === "ar" ? "الحالة الأكاديمية" : t("academic_status")}
                  field="academicStatus"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label={lang === "ar" ? "حالة السكن" : t("residence_status")}
                  field="residenceStatus"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label={lang === "ar" ? "البرنامج الأكاديمي" : t("program")}
                  field="program"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <SortHeader
                  label={t("iqomah_number")}
                  field="iqomah_expiry"
                  current={sortField}
                  order={sortOrder}
                  onSort={toggleSort}
                />
                <th className="text-start px-4 py-3 font-medium">{t("attachments")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {t("no_data")}
                  </td>
                </tr>
              )}
              {sorted.map((r) => {
                const displayName = r.arabicName || r.full_name || "—";
                const englishName = r.englishName || "";
                const isInside = (r.residenceStatus || "INSIDE_SAKAN") === "INSIDE_SAKAN";
                const isOnLeave = r.academicStatus === "ON_LEAVE";

                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`student-row-${r.id}`}>
                    {/* Student Info: Arabic Name, English Name, University ID */}
                    <td className="px-4 py-3">
                      <div className="leading-tight">
                        <div className="font-semibold text-slate-900">{displayName}</div>
                        {englishName && englishName !== displayName && (
                          <div className="text-xs text-muted-foreground mt-0.5">{englishName}</div>
                        )}
                        {r.universityId && (
                          <div className="text-[11px] text-primary font-mono mt-0.5">
                            {lang === "ar" ? "الرقم الجامعي: " : "ID: "}{r.universityId}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Nationality */}
                    <td className="px-4 py-3">{getCountryLabel(r.nationality, lang)}</td>

                    {/* Academic Status with Quick Change Dropdown */}
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-1.5 hover:bg-slate-100 flex items-center gap-1 text-xs"
                            title={lang === "ar" ? "تغيير الحالة الأكاديمية" : t("change_academic_status")}
                          >
                            {isOnLeave ? (
                              <Badge
                                variant="destructive"
                                className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-[11px] cursor-pointer"
                              >
                                <AlertCircle className="h-3 w-3" />
                                {lang === "ar" ? "مجاز / مؤجل" : t("status_on_leave")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="default"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-[11px] cursor-pointer"
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                {lang === "ar" ? "منتظم" : t("status_active")}
                              </Badge>
                            )}
                            <ChevronDown className="h-3 w-3 text-muted-foreground opacity-60" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel className="text-xs">
                            {lang === "ar" ? "تغيير الحالة الأكاديمية" : t("change_academic_status")}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => updateAcademicStatus(r, "ACTIVE")}
                            className="gap-2 cursor-pointer"
                          >
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            {lang === "ar" ? "منتظم (Active)" : t("status_active")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => updateAcademicStatus(r, "ON_LEAVE")}
                            className="gap-2 cursor-pointer text-amber-700 focus:text-amber-700"
                          >
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            {lang === "ar" ? "مجاز / مؤجل (On Leave)" : t("status_on_leave")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>

                    {/* Residence Status with Quick Change Modal Trigger */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openResidenceModal(r)}
                          className="h-auto p-1 hover:bg-slate-100 flex items-center gap-1.5 w-fit"
                          title={lang === "ar" ? "تعديل حالة وعنوان السكن" : t("change_residence_status")}
                        >
                          {isInside ? (
                            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[11px]">
                              {lang === "ar" ? "داخل السكن" : t("inside_sakan")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-sky-300 text-sky-800 bg-sky-50 text-[11px]">
                              {lang === "ar" ? "خارج السكن" : t("outside_sakan")}
                            </Badge>
                          )}
                          <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-60" />
                        </Button>
                        <div className="text-xs text-slate-700 ps-1 font-medium truncate max-w-[160px]">
                          {isInside
                            ? (r.room_number ? `${lang === "ar" ? "غرفة" : "Room"} ${r.room_number}` : "—")
                            : (r.address || "—")}
                        </div>
                      </div>
                    </td>

                    {/* Academic Program & Year */}
                    <td className="px-4 py-3">
                      <div className="text-xs leading-tight">
                        <div className="font-medium text-slate-800">{getProgramDisplay(r.programStudy || r.program)}</div>
                        <div className="text-muted-foreground mt-0.5">{r.academicYear || r.academic_year || "—"}</div>
                      </div>
                    </td>

                    {/* Iqamah */}
                    <td className="px-4 py-3 tabular-nums">
                      <div className="text-xs">
                        <div>{r.iqomah_number}</div>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px] mt-0.5">
                          {r.iqomah_expiry}
                        </Badge>
                      </div>
                    </td>

                    {/* Attachments */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5">
                        {r.passport_file_id && (
                          <FileThumb
                            fileId={r.passport_file_id}
                            label={t("passport")}
                            testid={`passport-${r.id}`}
                          />
                        )}
                        {r.iqomah_file_id && (
                          <FileThumb
                            fileId={r.iqomah_file_id}
                            label={t("iqomah_number")}
                            testid={`iqomah-${r.id}`}
                          />
                        )}
                        {!r.passport_file_id && !r.iqomah_file_id && (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(r)}
                          data-testid={`edit-${r.id}`}
                          title={t("edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => del(r.id)}
                            data-testid={`delete-${r.id}`}
                            title={t("delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Residence Status Change Modal */}
      <Dialog open={residenceModalOpen} onOpenChange={setResidenceModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {lang === "ar" ? "تعديل حالة وعنوان السكن" : t("change_residence_status")}
            </DialogTitle>
          </DialogHeader>
          {selectedStudentForResidence && (
            <form onSubmit={saveResidenceStatus} className="space-y-4 pt-2">
              <div className="text-sm bg-slate-50 p-2.5 rounded-md border border-slate-100">
                <span className="text-muted-foreground text-xs">{lang === "ar" ? "الطالب: " : "Student: "}</span>
                <span className="font-semibold block text-slate-800">
                  {selectedStudentForResidence.arabicName || selectedStudentForResidence.full_name}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">{lang === "ar" ? "حالة السكن" : t("residence_status")}</Label>
                <Select
                  value={residenceFormStatus}
                  onValueChange={(v) => setResidenceFormStatus(v as ResidenceStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INSIDE_SAKAN">
                      {lang === "ar" ? "داخل السكن (Inside Dorm)" : t("inside_sakan")}
                    </SelectItem>
                    <SelectItem value="OUTSIDE_SAKAN">
                      {lang === "ar" ? "خارج السكن (Outside Dorm)" : t("outside_sakan")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {residenceFormStatus === "INSIDE_SAKAN" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "ar" ? "رقم الغرفة" : t("room_number")}</Label>
                  <Input
                    required
                    value={residenceFormRoom}
                    onChange={(e) => setResidenceFormRoom(e.target.value)}
                    placeholder="مثال: 101"
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">{lang === "ar" ? "عنوان السكن" : t("residence_address")}</Label>
                  <Input
                    required
                    value={residenceFormAddress}
                    onChange={(e) => setResidenceFormAddress(e.target.value)}
                    placeholder="مثال: حي الزهور، حائل"
                  />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResidenceModalOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={savingResidence}>
                  {savingResidence ? "…" : t("save")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Manage Study Programs Modal (Admin only) */}
      <Dialog open={programsModalOpen} onOpenChange={setProgramsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-600" />
                {t("manage_programs")}
              </DialogTitle>
              <Button size="sm" onClick={openNewProgram} className="gap-1.5" data-testid="add-new-program-btn">
                <Plus className="h-4 w-4" />
                {t("add_program")}
              </Button>
            </div>
          </DialogHeader>

          {/* Search box for programs */}
          <div className="relative pt-2">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={lang === "ar" ? "ابحث في البرامج الدراسية..." : "Search study programs..."}
              value={programSearch}
              onChange={(e) => setProgramSearch(e.target.value)}
              className="ps-9 text-xs"
            />
          </div>

          <div className="border rounded-md overflow-hidden mt-3">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-start">{t("program_name_ar")}</th>
                  <th className="px-3 py-2.5 text-start">{t("program_name_en")}</th>
                  <th className="px-3 py-2.5 text-end w-24">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {programs
                  .filter((p) => {
                    if (!programSearch.trim()) return true;
                    const q = programSearch.toLowerCase();
                    return p.name_ar.toLowerCase().includes(q) || p.name_en.toLowerCase().includes(q);
                  })
                  .map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70" data-testid={`program-row-${p.id}`}>
                      <td className="px-3 py-2.5 font-medium text-slate-900" dir="rtl">
                        {p.name_ar}
                      </td>
                      <td className="px-3 py-2.5 text-slate-700" dir="ltr">
                        {p.name_en}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-600 hover:text-indigo-600"
                            onClick={() => openEditProgram(p)}
                            title={t("edit_program")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-600 hover:text-destructive"
                            onClick={() => deleteProgram(p)}
                            title={t("delete_program")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                {programs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                      {t("no_programs_found")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Single Program Sub-Dialog */}
      <Dialog open={programFormOpen} onOpenChange={setProgramFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingProgram ? t("edit_program") : t("add_program")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProgram} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("program_name_ar")} <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                dir="rtl"
                placeholder="مثال: هندسة البرمجيات"
                value={programForm.name_ar}
                onChange={(e) => setProgramForm({ ...programForm, name_ar: e.target.value })}
                className="text-xs text-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("program_name_en")} <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                dir="ltr"
                placeholder="e.g. Software Engineering"
                value={programForm.name_en}
                onChange={(e) => setProgramForm({ ...programForm, name_en: e.target.value })}
                className="text-xs text-start"
              />
            </div>
            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProgramFormOpen(false)}
                disabled={savingProgram}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={savingProgram}>
                {savingProgram ? "…" : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        required={required}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  order,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  order: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const isSorted = current === field;
  return (
    <th className="text-start px-4 py-3 font-medium select-none">
      <button
        type="button"
        onClick={() => onSort(field)}
        className="group inline-flex items-center gap-1.5 hover:text-slate-900 transition-colors font-medium text-start"
      >
        <span>{label}</span>
        {isSorted ? (
          order === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary shrink-0" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-70 transition-opacity shrink-0" />
        )}
      </button>
    </th>
  );
}
