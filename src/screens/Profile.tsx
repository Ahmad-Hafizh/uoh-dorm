"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCircle2,
  AlertTriangle,
  Pencil,
  ShieldCheck,
  Lock,
  Unlock,
  KeyRound,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { toast } from "sonner";
import { COUNTRIES, getCountryLabel } from "@/constants/countries";
import { cn } from "@/lib/utils";

export type ResidenceStatus = "INSIDE_SAKAN" | "OUTSIDE_SAKAN";
export type AcademicStatus = "ACTIVE" | "ON_LEAVE";

export interface ProfileEditSettings {
  allowArabicName: boolean;
  allowEnglishName: boolean;
  allowPhone: boolean;
  allowNationality: boolean;
  allowUniversityId: boolean;
  allowProgramStudy: boolean;
  allowAcademicYear: boolean;
  allowArrivalDate: boolean;
  allowResidenceStatus: boolean;
  allowRoomNumber: boolean;
  allowAddress: boolean;
  allowPassportInfo: boolean;
  allowIqamahInfo: boolean;
  allowDocumentsUpload: boolean;
}

export const defaultProfileEditSettings: ProfileEditSettings = {
  allowArabicName: false,
  allowEnglishName: false,
  allowPhone: true,
  allowNationality: false,
  allowUniversityId: false,
  allowProgramStudy: false,
  allowAcademicYear: false,
  allowArrivalDate: false,
  allowResidenceStatus: false,
  allowRoomNumber: false,
  allowAddress: true,
  allowPassportInfo: false,
  allowIqamahInfo: false,
  allowDocumentsUpload: true,
};

export interface ProfileData {
  id?: string;
  user_id?: string;
  arabicName?: string;
  englishName?: string;
  arabic_name?: string;
  english_name?: string;
  full_name?: string;

  universityId?: string | number;
  university_id?: string | number;

  arrivalDate?: string | Date | null;
  arrival_date?: string | Date | null;

  programStudy?: string;
  program_study?: string;
  program?: string;

  academicYear?: string;
  academic_year?: string;

  passportNumber?: string;
  passport_number?: string;
  passportExpiry?: string;
  passport_expiry?: string;

  iqamahNumber?: string;
  iqamah_number?: string;
  iqomah_number?: string;
  iqamahExpiry?: string;
  iqamah_expiry?: string;
  iqomah_expiry?: string;

  residenceStatus?: ResidenceStatus | string;
  residence_status?: ResidenceStatus | string;

  roomNumber?: string | null;
  room_number?: string | null;

  address?: string | null;

  academicStatus?: AcademicStatus | string;
  academic_status?: AcademicStatus | string;

  adminNotes?: string | null;
  admin_notes?: string | null;

  nationality?: string;
  phone?: string;
  building?: string;
  passport_file_id?: string | null;
  iqomah_file_id?: string | null;
}

interface ProfileProps {
  initialProfile?: ProfileData | null;
}

export default function Profile({ initialProfile }: ProfileProps = {}) {
  const { user, reload } = useAuth();
  const { t, lang } = useI18n();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(initialProfile || null);
  const currentUser = user || null;
  const userRole = (currentUser?.role || "").toUpperCase();
  const isStudent = userRole === "STUDENT" || currentUser?.role === "student";
  const isStaffOrAdmin = userRole === "ADMIN" || userRole === "STAFF";
  const isAdmin = userRole === "ADMIN" || currentUser?.role === "admin";

  const [queryId, setQueryId] = useState<string | null>(null);

  // Permissions settings state
  const [permissions, setPermissions] = useState<ProfileEditSettings>(defaultProfileEditSettings);
  const [permissionsForm, setPermissionsForm] = useState<ProfileEditSettings>(defaultProfileEditSettings);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Admin/Staff Account Edit Modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: "", password: "" });
  const [savingAccount, setSavingAccount] = useState(false);

  // Student Edit Profile Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    arabicName: string;
    englishName: string;
    phone: string;
    nationality: string;
    universityId: string;
    programStudy: string;
    academicYear: string;
    arrivalDate: string;
    residenceStatus: ResidenceStatus;
    roomNumber: string;
    address: string;
    passportNumber: string;
    passportExpiry: string;
    iqamahNumber: string;
    iqamahExpiry: string;
  }>({
    arabicName: "",
    englishName: "",
    phone: "",
    nationality: "",
    universityId: "",
    programStudy: "",
    academicYear: "",
    arrivalDate: "",
    residenceStatus: "INSIDE_SAKAN",
    roomNumber: "",
    address: "",
    passportNumber: "",
    passportExpiry: "",
    iqamahNumber: "",
    iqamahExpiry: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [programs, setPrograms] = useState<{ id: string; name_ar: string; name_en: string }[]>([]);

  // Read URL query parameter safely on client
  useEffect(() => {
    const qId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("id")
        : null;
    setQueryId(qId);
  }, []);

  // Load permissions and profile
  useEffect(() => {
    // Load edit permissions
    api
      .get("/settings/profile-permissions")
      .then((r) => {
        if (r.data) {
          setPermissions(r.data);
          setPermissionsForm(r.data);
        }
      })
      .catch(() => {});

    // Load study programs
    api
      .get("/programs")
      .then((r) => {
        if (Array.isArray(r.data)) setPrograms(r.data);
      })
      .catch(() => {});

    if (initialProfile) {
      setProfile(initialProfile);
      return;
    }

    if (isStudent) {
      // Student loads their own student profile
      api
        .get("/students/me")
        .then((r) => setProfile(r.data))
        .catch(() => {});
    } else if (queryId) {
      // Staff or Admin inspecting a specific student
      api
        .get(`/students/${queryId}`)
        .then((r) => setProfile(r.data))
        .catch(() => {});
    } else {
      // Staff or Admin viewing their own account profile:
      // DO NOT load any student profile! Keep profile null.
      setProfile(null);
    }
  }, [user, isStudent, queryId, initialProfile]);

  const patchFile = async (field: "passport_file_id" | "iqomah_file_id", fileId: string | null) => {
    try {
      const endpoint = isStudent ? "/students/me" : profile?.id ? `/students/${profile.id}` : "/students/me";
      const { data } = await api.patch(endpoint, { [field]: fileId });
      setProfile(data);
      toast.success(t("save") + " ✓");
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  const formatDate = (val?: string | Date | null) => {
    if (!val) return "—";
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toISOString().split("T")[0];
    } catch {
      return String(val);
    }
  };

  const isViewingStudent = isStudent || Boolean(queryId && profile);

  // Field values with resilient fallbacks
  const arabicName = profile?.arabicName || profile?.arabic_name || "—";
  const englishName = profile?.englishName || profile?.english_name || profile?.full_name || "—";
  const universityId = profile?.universityId ?? profile?.university_id ?? "—";
  const arrivalDate = formatDate(profile?.arrivalDate ?? profile?.arrival_date);

  const rawProgram = profile?.programStudy || profile?.program_study || profile?.program || "";
  const matchedProgram = programs.find(
    (p) =>
      p.id === rawProgram ||
      p.name_ar === rawProgram ||
      p.name_en === rawProgram
  );
  const programStudy = matchedProgram
    ? lang === "ar"
      ? matchedProgram.name_ar
      : matchedProgram.name_en
    : rawProgram || "—";
  const academicYear = profile?.academicYear || profile?.academic_year || "—";

  const passportNumber = profile?.passportNumber || profile?.passport_number || "—";
  const passportExpiry = formatDate(profile?.passportExpiry ?? profile?.passport_expiry);

  const iqamahNumber = profile?.iqamahNumber || profile?.iqamah_number || profile?.iqomah_number || "—";
  const iqamahExpiry = formatDate(profile?.iqamahExpiry ?? profile?.iqamah_expiry ?? profile?.iqomah_expiry);

  const residenceStatus: ResidenceStatus =
    (profile?.residenceStatus || profile?.residence_status || "INSIDE_SAKAN").toUpperCase() === "OUTSIDE_SAKAN"
      ? "OUTSIDE_SAKAN"
      : "INSIDE_SAKAN";

  const roomNumber = profile?.roomNumber || profile?.room_number || "—";
  const address = profile?.address || "—";

  const academicStatus: AcademicStatus =
    (profile?.academicStatus || profile?.academic_status || "ACTIVE").toUpperCase() === "ON_LEAVE"
      ? "ON_LEAVE"
      : "ACTIVE";

  const adminNotes = profile?.adminNotes ?? profile?.admin_notes ?? "";

  // The display name reflects the true owner of the profile:
  // - For Admin/Staff on their own profile: ALWAYS currentUser.name (e.g. "Demo Admin")
  // - For student or viewing specific student: the student's name
  const displayName = isStudent
    ? lang === "ar"
      ? profile?.arabicName || currentUser?.name
      : profile?.englishName || currentUser?.name
    : queryId && profile
    ? lang === "ar"
      ? profile.arabicName || profile.full_name || "—"
      : profile.englishName || profile.full_name || "—"
    : currentUser?.name || "—";

  // Determine if a field is editable for the current user
  const canEditField = (key: keyof ProfileEditSettings) => {
    if (isAdmin || isStaffOrAdmin) return true;
    return Boolean(permissions[key]);
  };

  // Open Edit Profile Modal for student
  const openEditModal = () => {
    const rawProg = profile?.programStudy || profile?.program_study || profile?.program || "";
    const matched = programs.find(
      (p) => p.id === rawProg || p.name_ar === rawProg || p.name_en === rawProg
    );
    const resolvedProg = matched ? matched.name_ar : rawProg;

    setEditForm({
      arabicName: profile?.arabicName || profile?.arabic_name || "",
      englishName: profile?.englishName || profile?.english_name || profile?.full_name || "",
      phone: profile?.phone || "",
      nationality: profile?.nationality || "",
      universityId: String(profile?.universityId ?? profile?.university_id ?? ""),
      programStudy: resolvedProg,
      academicYear: profile?.academicYear || profile?.academic_year || "2026/2027",
      arrivalDate: profile?.arrivalDate ? String(profile.arrivalDate).split("T")[0] : "",
      residenceStatus: residenceStatus,
      roomNumber: profile?.roomNumber || profile?.room_number || "",
      address: profile?.address || "",
      passportNumber: profile?.passportNumber || profile?.passport_number || "",
      passportExpiry: profile?.passportExpiry ? String(profile.passportExpiry).split("T")[0] : "",
      iqamahNumber: profile?.iqamahNumber || profile?.iqamah_number || profile?.iqomah_number || "",
      iqamahExpiry: profile?.iqamahExpiry ? String(profile.iqamahExpiry).split("T")[0] : "",
    });
    setEditModalOpen(true);
  };

  // Submit profile edit
  const submitProfileEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        arabicName: editForm.arabicName,
        englishName: editForm.englishName,
        phone: editForm.phone,
        nationality: editForm.nationality,
        universityId: editForm.universityId,
        programStudy: editForm.programStudy,
        program: editForm.programStudy,
        academicYear: editForm.academicYear,
        academic_year: editForm.academicYear,
        arrivalDate: editForm.arrivalDate || null,
        residenceStatus: editForm.residenceStatus,
        roomNumber: editForm.residenceStatus === "INSIDE_SAKAN" ? editForm.roomNumber : null,
        room_number: editForm.residenceStatus === "INSIDE_SAKAN" ? editForm.roomNumber : null,
        address: editForm.residenceStatus === "OUTSIDE_SAKAN" ? editForm.address : null,
        passportNumber: editForm.passportNumber,
        passport_number: editForm.passportNumber,
        passportExpiry: editForm.passportExpiry || null,
        passport_expiry: editForm.passportExpiry || null,
        iqamahNumber: editForm.iqamahNumber,
        iqamah_number: editForm.iqamahNumber,
        iqomah_number: editForm.iqamahNumber,
        iqamahExpiry: editForm.iqamahExpiry || null,
        iqamah_expiry: editForm.iqamahExpiry || null,
        iqomah_expiry: editForm.iqamahExpiry || null,
        full_name: editForm.englishName || editForm.arabicName,
      };

      let updatedData: ProfileData;
      if (isStudent) {
        const { data } = await api.patch("/students/me", payload);
        updatedData = data;
      } else if (profile?.id) {
        const { data } = await api.patch(`/students/${profile.id}`, payload);
        updatedData = data;
      } else {
        const { data } = await api.patch("/students/me", payload);
        updatedData = data;
      }

      setProfile((prev) => ({ ...prev, ...updatedData, ...payload }));
      toast.success(lang === "ar" ? "تم تحديث بيانات الملف الشخصي بنجاح" : t("profile_updated"));
      setEditModalOpen(false);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSavingProfile(false);
    }
  };

  // Open Edit Account Modal for Admin/Staff
  const openAccountModal = () => {
    setAccountForm({
      name: currentUser?.name || "",
      password: "",
    });
    setAccountModalOpen(true);
  };

  const submitAccountEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSavingAccount(true);
    try {
      const payload: { name: string; password?: string } = { name: accountForm.name };
      if (accountForm.password) payload.password = accountForm.password;
      await api.patch(`/staff/${currentUser.id}`, payload);
      await reload();
      toast.success(lang === "ar" ? "تم تحديث بيانات الحساب بنجاح" : "Account updated successfully");
      setAccountModalOpen(false);
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSavingAccount(false);
    }
  };

  // Submit Admin Permissions
  const submitPermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPermissions(true);
    try {
      const { data } = await api.patch("/settings/profile-permissions", permissionsForm);
      setPermissions(data);
      toast.success(lang === "ar" ? "تم حفظ إعدادات الصلاحيات بنجاح" : t("settings_saved"));
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSavingPermissions(false);
    }
  };

  const toggleAllPermissions = (value: boolean) => {
    setPermissionsForm({
      allowArabicName: value,
      allowEnglishName: value,
      allowPhone: value,
      allowNationality: value,
      allowUniversityId: value,
      allowProgramStudy: value,
      allowAcademicYear: value,
      allowArrivalDate: value,
      allowResidenceStatus: value,
      allowRoomNumber: value,
      allowAddress: value,
      allowPassportInfo: value,
      allowIqamahInfo: value,
      allowDocumentsUpload: value,
    });
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="profile-page">
      {/* Banner when Admin/Staff is inspecting a student via queryId */}
      {queryId && profile && (
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-primary/20 bg-primary/5 text-sm">
          <div className="flex items-center gap-2 text-primary font-medium">
            <UserCircle2 className="h-5 w-5" />
            <span>
              {lang === "ar" ? "معاينة ملف الطالب: " : t("viewing_student_profile") + ": "}
              <strong className="text-slate-900">{profile.arabicName || profile.englishName || profile.full_name}</strong>
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/profile")}
            className="text-xs h-8 text-primary hover:bg-primary/10 gap-1.5"
          >
            {lang === "ar" ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{lang === "ar" ? "العودة إلى ملفي الشخصي" : t("back_to_my_profile")}</span>
          </Button>
        </div>
      )}

      {/* Page Header with Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("profile")}</h1>

        <div className="flex items-center gap-2">
          {/* Admin Edit Account Button (Admin/Staff only) */}
          {!isViewingStudent && (
            <Button
              variant="outline"
              size="sm"
              onClick={openAccountModal}
              className="gap-2"
              data-testid="edit-account-btn"
            >
              <Pencil className="h-4 w-4" />
              <span>{lang === "ar" ? "تعديل بيانات الحساب" : t("edit_account")}</span>
            </Button>
          )}

          {/* Edit Student Profile Button */}
          {isViewingStudent && (
            <Button
              onClick={openEditModal}
              size="sm"
              className="gap-2"
              data-testid="edit-profile-btn"
            >
              <Pencil className="h-4 w-4" />
              <span>{lang === "ar" ? "تعديل الملف الشخصي" : t("edit_profile")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Warning alert banner shown below header when student is ON_LEAVE */}
      {isViewingStudent && academicStatus === "ON_LEAVE" && (
        <Alert variant="warning" className="border-amber-300 bg-amber-50 text-amber-900 shadow-sm" data-testid="leave-warning-alert">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <AlertTitle className="font-semibold text-amber-900">
            {lang === "ar" ? "تنبيه: الطالب في حالة إجازة / تأجيل" : t("leave_alert_title")}
          </AlertTitle>
          <AlertDescription className="text-xs sm:text-sm text-amber-800 mt-1">
            {lang === "ar"
              ? "الحالة الأكاديمية للطالب حالياً (مجاز / مؤجل). يرجى مراجعة إدارة السكن وشؤون الطلاب بشأن الإجراءات والخدمات السكنية."
              : t("leave_alert_desc")}
          </AlertDescription>
        </Alert>
      )}

      {/* Top Profile Card */}
      <Card className="p-6 border-slate-200">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
            <UserCircle2 className="h-9 w-9" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold truncate">{displayName}</div>
            <div className="text-sm text-muted-foreground truncate">{currentUser?.email}</div>

            {/* Badges below user's email */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/15 uppercase text-[10px]">
                {currentUser?.role}
              </Badge>

              {/* Show Academic Status badge ONLY when viewing student profile */}
              {isViewingStudent && (
                academicStatus === "ACTIVE" ? (
                  <Badge
                    variant="default"
                    className="text-[11px] font-medium"
                    data-testid="academic-status-badge"
                  >
                    {lang === "ar" ? "منتظم" : t("status_active")}
                  </Badge>
                ) : (
                  <Badge
                    variant="destructive"
                    className="text-[11px] font-medium bg-amber-600 hover:bg-amber-700 text-white border-transparent"
                    data-testid="academic-status-badge"
                  >
                    {lang === "ar" ? "مجاز / مؤجل" : t("status_on_leave")}
                  </Badge>
                )
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* STUDENT PROFILE SECTION (Only shown for student or when admin/staff inspects student via queryId) */}
      {isViewingStudent && (
        <>
          {/* Data Grid Card */}
          <Card className="p-6 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("student")} {t("profile")}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={openEditModal}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-slate-900 gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>{lang === "ar" ? "تعديل" : t("edit")}</span>
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {/* Arabic Name & English Name */}
              <Row label={lang === "ar" ? "الاسم بالعربي" : t("arabic_name")} value={arabicName} />
              <Row label={lang === "ar" ? "الاسم بالإنجليزية" : t("english_name")} value={englishName} />

              {/* University ID & Arrival Date */}
              <Row label={lang === "ar" ? "الرقم الجامعي" : t("university_id")} value={String(universityId)} />
              <Row label={lang === "ar" ? "تاريخ الوصول" : t("arrival_date")} value={arrivalDate} />

              {/* Academic info */}
              <Row label={lang === "ar" ? "البرنامج الأكاديمي" : t("program")} value={programStudy} />
              <Row label={lang === "ar" ? "السنة الدراسية" : t("academic_year")} value={academicYear} />

              {/* Conditional Residence Status: Room Number or Residence Address */}
              {residenceStatus === "INSIDE_SAKAN" ? (
                <Row label={lang === "ar" ? "رقم الغرفة" : t("room_number")} value={roomNumber} />
              ) : (
                <Row label={lang === "ar" ? "عنوان السكن" : t("residence_address")} value={address} />
              )}

              {/* Nationality & Phone */}
              <Row
                label={lang === "ar" ? "الجنسية" : t("nationality")}
                value={profile?.nationality ? getCountryLabel(profile.nationality, lang) : "—"}
              />
              <Row label={lang === "ar" ? "رقم الهاتف" : t("phone")} value={profile?.phone || "—"} />

              {/* Passport details */}
              <Row label={lang === "ar" ? "رقم الجواز" : t("passport")} value={passportNumber} />
              <Row label={lang === "ar" ? "انتهاء الجواز" : t("passport_expiry")} value={passportExpiry} />

              {/* Iqamah details */}
              <Row label={lang === "ar" ? "رقم الإقامة" : t("iqomah_number")} value={iqamahNumber} />
              <Row label={lang === "ar" ? "انتهاء الإقامة" : t("iqomah_expiry")} value={iqamahExpiry} />

              {/* Role-Based Access: Render Admin Notes ONLY IF current session user has role === 'ADMIN' or role === 'STAFF' */}
              {isStaffOrAdmin && (
                <Row
                  label={lang === "ar" ? "ملاحظات" : t("admin_notes")}
                  value={adminNotes || "—"}
                  className="sm:col-span-2"
                />
              )}
            </div>
          </Card>

          {/* Student Documents Upload Section */}
          <Card className="p-6 border-slate-200" data-testid="my-documents-section">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {t("my_documents")}
              </div>
              {!canEditField("allowDocumentsUpload") && (
                <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200 gap-1">
                  <Lock className="h-2.5 w-2.5" />
                  {lang === "ar" ? "رفع الملفات مقفل من الإدارة" : t("locked_by_admin")}
                </Badge>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("passport_file")}</Label>
                <FileUpload
                  kind="passport"
                  value={profile?.passport_file_id || null}
                  onChange={(id: string | null) => {
                    if (canEditField("allowDocumentsUpload")) patchFile("passport_file_id", id);
                    else toast.error(lang === "ar" ? "رفع الوثائق مغلق حالياً من قبل الإدارة" : t("locked_by_admin"));
                  }}
                  label={t("upload_passport_now")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("iqomah_file")}</Label>
                <FileUpload
                  kind="iqomah"
                  value={profile?.iqomah_file_id || null}
                  onChange={(id: string | null) => {
                    if (canEditField("allowDocumentsUpload")) patchFile("iqomah_file_id", id);
                    else toast.error(lang === "ar" ? "رفع الوثائق مغلق حالياً من قبل الإدارة" : t("locked_by_admin"));
                  }}
                  label={t("upload_iqomah_now")}
                />
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ADMIN PERMISSIONS SETTINGS PANEL (Rendered directly on Admin's own profile page) */}
      {!isViewingStudent && isAdmin && (
        <Card className="p-6 border-slate-200 space-y-5" data-testid="admin-permissions-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-slate-900 text-base">
                  {lang === "ar" ? "إعدادات صلاحيات تعديل ملف الطالب" : t("profile_edit_permissions")}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lang === "ar"
                  ? "حدد الحقول والبيانات التي تسمح إدارة السكن للطلاب بتعديلها بأنفسهم عبر حساباتهم."
                  : t("profile_permissions_desc")}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => toggleAllPermissions(true)}
              >
                <Unlock className="h-3.5 w-3.5 me-1 text-emerald-600" />
                {lang === "ar" ? "تفعيل الكل" : t("enable_all")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => toggleAllPermissions(false)}
              >
                <Lock className="h-3.5 w-3.5 me-1 text-amber-600" />
                {lang === "ar" ? "تعطيل الكل" : t("disable_all")}
              </Button>
            </div>
          </div>

          <form onSubmit={submitPermissions} className="space-y-4">
            {/* Category 1: Personal Info */}
            <PermissionSection title={lang === "ar" ? "المعلومات الشخصية" : t("personal_info")}>
              <PermissionRow
                title={lang === "ar" ? "الاسم بالعربي" : t("arabic_name")}
                description={lang === "ar" ? "السماح للطالب بتعديل اسمه بالعربية" : "Allow student to edit Arabic name"}
                checked={permissionsForm.allowArabicName}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowArabicName: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "الاسم بالإنجليزية" : t("english_name")}
                description={lang === "ar" ? "السماح للطالب بتعديل اسمه بالإنجليزية" : "Allow student to edit English name"}
                checked={permissionsForm.allowEnglishName}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowEnglishName: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "رقم الهاتف" : t("phone")}
                description={lang === "ar" ? "السماح للطالب بتحديث رقم جواله للتواصل" : "Allow student to update phone number"}
                checked={permissionsForm.allowPhone}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowPhone: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "الجنسية" : t("nationality")}
                description={lang === "ar" ? "السماح للطالب بتعديل دولته / جنسيته" : "Allow student to edit nationality"}
                checked={permissionsForm.allowNationality}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowNationality: v })}
              />
            </PermissionSection>

            {/* Category 2: Academic Info */}
            <PermissionSection title={lang === "ar" ? "المعلومات الأكاديمية" : t("academic_info")}>
              <PermissionRow
                title={lang === "ar" ? "الرقم الجامعي" : t("university_id")}
                description={lang === "ar" ? "السماح للطالب بتعديل رقمه الجامعي (موصى بتعطيله)" : "Allow student to edit University ID"}
                checked={permissionsForm.allowUniversityId}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowUniversityId: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "البرنامج الأكاديمي" : t("program")}
                description={lang === "ar" ? "السماح بتعديل الكلية أو التخصص" : "Allow student to edit academic program"}
                checked={permissionsForm.allowProgramStudy}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowProgramStudy: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "السنة الدراسية" : t("academic_year")}
                description={lang === "ar" ? "السماح بتعديل العام الأكاديمي المقيد به" : "Allow student to edit academic year"}
                checked={permissionsForm.allowAcademicYear}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowAcademicYear: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "تاريخ الوصول" : t("arrival_date")}
                description={lang === "ar" ? "السماح للطالب بتحديث تاريخ وصوله للمملكة" : "Allow student to edit arrival date"}
                checked={permissionsForm.allowArrivalDate}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowArrivalDate: v })}
              />
            </PermissionSection>

            {/* Category 3: Residence Info */}
            <PermissionSection title={lang === "ar" ? "معلومات السكن" : t("residence_info")}>
              <PermissionRow
                title={lang === "ar" ? "حالة السكن (داخل / خارج)" : t("residence_status")}
                description={lang === "ar" ? "السماح للطالب بتغيير صفة سكنه بين داخلي وخارجي" : "Allow student to toggle inside/outside dorm"}
                checked={permissionsForm.allowResidenceStatus}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowResidenceStatus: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "رقم الغرفة" : t("room_number")}
                description={lang === "ar" ? "السماح للطالب بتحديث رقم غرفته بالسكن" : "Allow student to update room number"}
                checked={permissionsForm.allowRoomNumber}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowRoomNumber: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "عنوان السكن الخارجي" : t("residence_address")}
                description={lang === "ar" ? "السماح للطالب الساكن بالخارج بتحديث عنوان منزله" : "Allow student to update outside address"}
                checked={permissionsForm.allowAddress}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowAddress: v })}
              />
            </PermissionSection>

            {/* Category 4: Documents & Identity */}
            <PermissionSection title={lang === "ar" ? "الوثائق والهوية" : t("documents_info")}>
              <PermissionRow
                title={lang === "ar" ? "بيانات الجواز (الرقم والانتهاء)" : t("passport")}
                description={lang === "ar" ? "السماح للطالب بتعديل رقم جواز السفر وتاريخ صلاحيته" : "Allow student to edit passport details"}
                checked={permissionsForm.allowPassportInfo}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowPassportInfo: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "بيانات الإقامة (الرقم والانتهاء)" : t("iqomah_number")}
                description={lang === "ar" ? "السماح للطالب بتعديل رقم الإقامة وتاريخ انتهائها" : "Allow student to edit Iqamah details"}
                checked={permissionsForm.allowIqamahInfo}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowIqamahInfo: v })}
              />
              <PermissionRow
                title={lang === "ar" ? "رفع واستبدال صور الوثائق" : t("attachments")}
                description={lang === "ar" ? "السماح للطالب برفع أو استبدال صور الجواز والإقامة" : "Allow student to upload document scans"}
                checked={permissionsForm.allowDocumentsUpload}
                onChange={(v) => setPermissionsForm({ ...permissionsForm, allowDocumentsUpload: v })}
              />
            </PermissionSection>

            <div className="pt-2 flex justify-end">
              <Button type="submit" disabled={savingPermissions} data-testid="save-permissions-btn">
                {savingPermissions ? "…" : lang === "ar" ? "حفظ التغييرات" : t("save_settings")}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Admin/Staff Edit Account Modal Dialog */}
      <Dialog open={accountModalOpen} onOpenChange={setAccountModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-primary" />
              <span>{lang === "ar" ? "تعديل بيانات الحساب" : t("edit_account")}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAccountEdit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{lang === "ar" ? "الاسم الكامل" : t("name")}</Label>
              <Input
                required
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("change_password")}</Label>
              <Input
                type="password"
                placeholder={t("leave_blank_keep")}
                value={accountForm.password}
                onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAccountModalOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={savingAccount}>
                {savingAccount ? "…" : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Modal Dialog (For student or when inspecting student) */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Pencil className="h-5 w-5 text-primary" />
              <span>{lang === "ar" ? "تعديل بيانات الملف الشخصي" : t("edit_profile")}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={submitProfileEdit} className="space-y-5 pt-2">
            {/* Notification hint for student */}
            {isStudent && !isAdmin && (
              <div className="text-xs text-muted-foreground bg-slate-50 border border-slate-100 rounded-md p-3 leading-relaxed">
                {lang === "ar"
                  ? "ملاحظة: الحقول التي تحمل علامة القفل 🔒 يتم تحديد صلاحيات تعديلها من قبل إدارة السكن."
                  : "Note: Fields marked with 🔒 are locked and can only be modified by Dormitory Administration."}
              </div>
            )}

            {/* Personal Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary border-b border-slate-100 pb-1">
                {lang === "ar" ? "المعلومات الشخصية" : t("personal_info")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <EditField
                  label={lang === "ar" ? "الاسم بالعربي" : t("arabic_name")}
                  value={editForm.arabicName}
                  onChange={(v) => setEditForm({ ...editForm, arabicName: v })}
                  disabled={!canEditField("allowArabicName")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "الاسم بالإنجليزية" : t("english_name")}
                  value={editForm.englishName}
                  onChange={(v) => setEditForm({ ...editForm, englishName: v })}
                  disabled={!canEditField("allowEnglishName")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "رقم الهاتف" : t("phone")}
                  value={editForm.phone}
                  onChange={(v) => setEditForm({ ...editForm, phone: v })}
                  disabled={!canEditField("allowPhone")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{t("nationality")}</Label>
                    {!canEditField("allowNationality") && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 font-normal">
                        <Lock className="h-2.5 w-2.5" />
                        {lang === "ar" ? "مغلق" : t("locked_by_admin")}
                      </span>
                    )}
                  </div>
                  <Select
                    disabled={!canEditField("allowNationality")}
                    value={editForm.nationality || ""}
                    onValueChange={(v) => setEditForm({ ...editForm, nationality: v })}
                  >
                    <SelectTrigger className={!canEditField("allowNationality") ? "bg-slate-50 opacity-75" : ""}>
                      <SelectValue placeholder="—">
                        {editForm.nationality ? getCountryLabel(editForm.nationality, lang) : null}
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
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary border-b border-slate-100 pb-1">
                {lang === "ar" ? "المعلومات الأكاديمية" : t("academic_info")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <EditField
                  label={lang === "ar" ? "الرقم الجامعي" : t("university_id")}
                  value={editForm.universityId}
                  onChange={(v) => setEditForm({ ...editForm, universityId: v })}
                  disabled={!canEditField("allowUniversityId")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "تاريخ الوصول" : t("arrival_date")}
                  type="date"
                  value={editForm.arrivalDate}
                  onChange={(v) => setEditForm({ ...editForm, arrivalDate: v })}
                  disabled={!canEditField("allowArrivalDate")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      {lang === "ar" ? "البرنامج الأكاديمي" : t("program")}
                    </Label>
                    {!canEditField("allowProgramStudy") && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                        <Lock className="h-3 w-3" />
                        {lang === "ar" ? "مغلق" : t("locked_by_admin")}
                      </span>
                    )}
                  </div>
                  <Select
                    value={editForm.programStudy}
                    onValueChange={(v) => setEditForm({ ...editForm, programStudy: v })}
                    disabled={!canEditField("allowProgramStudy")}
                  >
                    <SelectTrigger className="w-full text-xs bg-white" data-testid="profile-program-select">
                      <SelectValue placeholder={t("select_program")}>
                        {editForm.programStudy ? (
                          (() => {
                            const found = programs.find(
                              (p) =>
                                p.id === editForm.programStudy ||
                                p.name_ar === editForm.programStudy ||
                                p.name_en === editForm.programStudy
                            );
                            if (!found) return editForm.programStudy;
                            return lang === "ar" ? found.name_ar : found.name_en;
                          })()
                        ) : null}
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
                      {editForm.programStudy &&
                        !programs.some((p) => p.name_ar === editForm.programStudy) && (
                          <SelectItem value={editForm.programStudy}>
                            {editForm.programStudy}
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                </div>
                <EditField
                  label={lang === "ar" ? "السنة الدراسية" : t("academic_year")}
                  value={editForm.academicYear}
                  onChange={(v) => setEditForm({ ...editForm, academicYear: v })}
                  disabled={!canEditField("allowAcademicYear")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
              </div>
            </div>

            {/* Residence Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary border-b border-slate-100 pb-1">
                {lang === "ar" ? "معلومات السكن" : t("residence_info")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">{lang === "ar" ? "حالة السكن" : t("residence_status")}</Label>
                    {!canEditField("allowResidenceStatus") && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 font-normal">
                        <Lock className="h-2.5 w-2.5" />
                        {lang === "ar" ? "مغلق" : t("locked_by_admin")}
                      </span>
                    )}
                  </div>
                  <Select
                    disabled={!canEditField("allowResidenceStatus")}
                    value={editForm.residenceStatus}
                    onValueChange={(v) => setEditForm({ ...editForm, residenceStatus: v as ResidenceStatus })}
                  >
                    <SelectTrigger className={!canEditField("allowResidenceStatus") ? "bg-slate-50 opacity-75" : ""}>
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

                {editForm.residenceStatus === "INSIDE_SAKAN" ? (
                  <div className="sm:col-span-2">
                    <EditField
                      label={lang === "ar" ? "رقم الغرفة" : t("room_number")}
                      value={editForm.roomNumber}
                      onChange={(v) => setEditForm({ ...editForm, roomNumber: v })}
                      disabled={!canEditField("allowRoomNumber")}
                      lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <EditField
                      label={lang === "ar" ? "عنوان السكن" : t("residence_address")}
                      value={editForm.address}
                      onChange={(v) => setEditForm({ ...editForm, address: v })}
                      disabled={!canEditField("allowAddress")}
                      lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Documents Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-primary border-b border-slate-100 pb-1">
                {lang === "ar" ? "بيانات الجواز والإقامة" : t("documents_info")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <EditField
                  label={lang === "ar" ? "رقم الجواز" : t("passport")}
                  value={editForm.passportNumber}
                  onChange={(v) => setEditForm({ ...editForm, passportNumber: v })}
                  disabled={!canEditField("allowPassportInfo")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "انتهاء الجواز" : t("passport_expiry")}
                  type="date"
                  value={editForm.passportExpiry}
                  onChange={(v) => setEditForm({ ...editForm, passportExpiry: v })}
                  disabled={!canEditField("allowPassportInfo")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "رقم الإقامة" : t("iqomah_number")}
                  value={editForm.iqamahNumber}
                  onChange={(v) => setEditForm({ ...editForm, iqamahNumber: v })}
                  disabled={!canEditField("allowIqamahInfo")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
                <EditField
                  label={lang === "ar" ? "انتهاء الإقامة" : t("iqomah_expiry")}
                  type="date"
                  value={editForm.iqamahExpiry}
                  onChange={(v) => setEditForm({ ...editForm, iqamahExpiry: v })}
                  disabled={!canEditField("allowIqamahInfo")}
                  lockedLabel={lang === "ar" ? "مغلق" : t("locked_by_admin")}
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setEditModalOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "…" : lang === "ar" ? "حفظ التعديلات" : t("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between border-b border-slate-100 pb-2 gap-4", className)}>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium tabular-nums text-slate-800 text-end truncate">{value || "—"}</span>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  disabled = false,
  type = "text",
  required = false,
  lockedLabel = "مغلق",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  required?: boolean;
  lockedLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {disabled && (
          <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded flex items-center gap-1 font-normal">
            <Lock className="h-2.5 w-2.5" />
            {lockedLabel}
          </span>
        )}
      </div>
      <Input
        type={type}
        required={required && !disabled}
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={disabled ? "bg-slate-50 cursor-not-allowed opacity-75" : ""}
      />
    </div>
  );
}

function PermissionSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border border-slate-100 rounded-lg p-3.5 bg-white">
      <h5 className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</h5>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function PermissionRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <div className="space-y-0.5">
        <div className="text-xs font-medium text-slate-900">{title}</div>
        <div className="text-[11px] text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
