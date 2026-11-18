"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import axios from "axios";
import { toast } from "sonner";
import { useI18n } from "@/context/I18nContext";
import { api, formatApiError } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DatePicker, DateRangePicker, parseISODate } from "@/components/ui/date-picker";
import { AirportCombobox } from "@/components/AirportCombobox";
import FileUpload from "@/components/FileUpload";
import {
  Plus,
  AlertCircle,
  CreditCard,
  Paperclip,
  ShieldCheck,
  Plane,
  FileText,
} from "lucide-react";

export interface DocumentRequestItem {
  id: string;
  user_id: string;
  user_name: string;
  request_type: string;
  notes?: string | null;
  attachment_file_ids?: string[] | null;
  status: string;
  admin_note?: string | null;
  dynamic_data?: any;
  result_file_id?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface StudentProfileData {
  id?: string | null;
  user_id?: string | null;
  full_name?: string | null;
  arabicName?: string | null;
  englishName?: string | null;
  residency_type?: string | null;
  residencyType?: string | null;
  residency_number?: string | null;
  residencyNumber?: string | null;
  residency_expiry?: string | null;
  residencyExpiry?: string | null;
  passport_number?: string | null;
  passportNumber?: string | null;
  passport_expiry?: string | null;
  passportExpiry?: string | null;
  passport_issue_date?: string | null;
  passportIssueDate?: string | null;
  passport_issuing_office?: string | null;
  passportIssuingOffice?: string | null;
  passport_file_id?: string | null;
  passportFileId?: string | null;
  residency_file_id?: string | null;
  residencyFileId?: string | null;
  [key: string]: any;
}

export interface NewDocumentRequestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows?: DocumentRequestItem[];
  studentProfile?: StudentProfileData | null;
  systemSettings?: { is_ticket_window_open: boolean };
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export interface FormDataValues {
  request_type: string;
  notes: string;
  attachment_file_ids: string[];
  origin: string;
  destination: string;
  trip_type: "one_way" | "round_trip";
  departure_date: string;
  return_date: string;
  new_passport_number: string;
  date_of_issue: string;
  date_of_expiry: string;
  issuing_office: string;
  passport_file: string | null;
  // Dynamic fields for exit_reentry_visa
  visa_validity_type: "return_before" | "duration_days";
  return_to_ksa_before: string;
  duration_days: number | string;
  // Dynamic fields for letter_of_enrollment
  addressed_to: string;
  addressed_to_other: string;
  letter_language: "ar" | "en";
  delivery_method: "softcopy" | "hardcopy";
}

const ALL_TYPES = [
  "iqomah_renewal",
  "return_ticket",
  "letter_of_enrollment",
  "exit_reentry_visa",
  "update_passport",
  "other",
];

export function NewDocumentRequest({
  open,
  onOpenChange,
  rows: initialRows,
  studentProfile: initialProfile,
  systemSettings: initialSettings,
  onSuccess,
  trigger,
}: NewDocumentRequestProps) {
  const { t, lang } = useI18n();
  const [saving, setSaving] = useState(false);
  const [internalRows, setInternalRows] = useState<DocumentRequestItem[]>([]);
  const [internalProfile, setInternalProfile] = useState<StudentProfileData | null>(null);
  const [internalSettings, setInternalSettings] = useState<{ is_ticket_window_open: boolean }>({
    is_ticket_window_open: false,
  });

  // Effective state: props take precedence, fallback to internally fetched data
  const currentRows = initialRows ?? internalRows;
  const currentProfile = initialProfile ?? internalProfile;
  const currentSettings = initialSettings ?? internalSettings;

  // Fetch missing data if not provided via props
  useEffect(() => {
    if (open) {
      if (!initialRows) {
        api.get("/documents")
          .then((res) => setInternalRows(res.data))
          .catch(() => {});
      }
      if (!initialProfile) {
        api.get("/students/me")
          .then((res) => setInternalProfile(res.data))
          .catch(() => {});
      }
      if (!initialSettings) {
        api.get("/settings/system")
          .then((res) => setInternalSettings(res.data))
          .catch(() => {});
      }
    }
  }, [open, initialRows, initialProfile, initialSettings]);

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormDataValues>({
    defaultValues: {
      request_type: "iqomah_renewal",
      notes: "",
      attachment_file_ids: [],
      origin: "Hail (HAS)",
      destination: "",
      trip_type: "round_trip",
      departure_date: "",
      return_date: "",
      new_passport_number: "",
      date_of_issue: "",
      date_of_expiry: "",
      issuing_office: "",
      passport_file: null,
      visa_validity_type: "return_before",
      return_to_ksa_before: "",
      duration_days: "",
      addressed_to: "Bank",
      addressed_to_other: "",
      letter_language: "ar",
      delivery_method: "softcopy",
    },
  });

  const watchedRequestType = watch("request_type");
  const watchedDestination = watch("destination");
  const watchedTripType = watch("trip_type");
  const watchedDepartureDate = watch("departure_date");
  const watchedReturnDate = watch("return_date");
  const watchedAttachments = watch("attachment_file_ids");
  const watchedPassportFile = watch("passport_file");
  const watchedVisaValidityType = watch("visa_validity_type");
  const watchedReturnToKsaBefore = watch("return_to_ksa_before");
  const watchedDurationDays = watch("duration_days");
  const watchedAddressedTo = watch("addressed_to");
  const watchedAddressedToOther = watch("addressed_to_other");
  const watchedLetterLanguage = watch("letter_language");
  const watchedDeliveryMethod = watch("delivery_method");

  // Determine student residency type
  const studentResidencyType = useMemo(() => {
    const raw =
      currentProfile?.residency_type ||
      currentProfile?.residencyType ||
      (currentProfile?.residency_number?.startsWith("3") ||
      currentProfile?.residency_number?.startsWith("4")
        ? "STUDENT_VISA"
        : "IQOMAH");
    return raw === "STUDENT_VISA" ? "STUDENT_VISA" : "IQOMAH";
  }, [currentProfile]);

  const studentResidencyExpiry = useMemo(() => {
    return (
      currentProfile?.residency_expiry ||
      currentProfile?.residencyExpiry ||
      "—"
    );
  }, [currentProfile]);

  // Iqomah expiry date and validity calculations
  const iqomahExpiryDate = useMemo(() => {
    const raw = currentProfile?.residency_expiry || currentProfile?.residencyExpiry;
    if (!raw || raw === "—") return null;
    return raw;
  }, [currentProfile]);

  const daysRemainingInIqomah = useMemo(() => {
    if (!iqomahExpiryDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = parseISODate(iqomahExpiryDate);
    if (!expDate) return null;
    return Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [iqomahExpiryDate]);

  // Check if visa validity exceeds Iqomah expiry
  const visaValidityExceeded = useMemo(() => {
    if (watchedRequestType !== "exit_reentry_visa" || !iqomahExpiryDate) {
      return false;
    }

    if (watchedVisaValidityType === "return_before") {
      if (!watchedReturnToKsaBefore) return false;
      return watchedReturnToKsaBefore > iqomahExpiryDate;
    }

    if (watchedVisaValidityType === "duration_days") {
      if (!watchedDurationDays) return false;
      const days = Number(watchedDurationDays);
      if (isNaN(days) || days <= 0) return false;
      if (daysRemainingInIqomah !== null) {
        return days > daysRemainingInIqomah;
      }
    }

    return false;
  }, [
    watchedRequestType,
    iqomahExpiryDate,
    watchedVisaValidityType,
    watchedReturnToKsaBefore,
    watchedDurationDays,
    daysRemainingInIqomah,
  ]);

  // Available document types based on student residency:
  // Exit/Re-entry Visa ONLY available if student residency is IQOMAH
  const availableDocumentTypes = useMemo(() => {
    if (studentResidencyType !== "IQOMAH") {
      return ALL_TYPES.filter((type) => type !== "exit_reentry_visa");
    }
    return ALL_TYPES;
  }, [studentResidencyType]);

  // Synchronous client-side duplicate check:
  // Check if student currently has a request of the selected type with status pending or in_progress
  const activeDuplicateRequest = useMemo(() => {
    if (!currentRows || currentRows.length === 0) return null;
    return currentRows.find(
      (doc) =>
        doc.request_type === watchedRequestType &&
        ["pending", "in_progress"].includes((doc.status || "").toLowerCase())
    );
  }, [currentRows, watchedRequestType]);

  const hasActiveRequest = Boolean(activeDuplicateRequest);

  // Localized document type name
  const selectedDocTypeName = useMemo(() => {
    if (
      watchedRequestType === "iqomah_renewal" &&
      studentResidencyType === "STUDENT_VISA"
    ) {
      return lang === "ar" ? "تجديد تأشيرة الطالب" : "Student Visa Renewal";
    }
    return t(watchedRequestType);
  }, [watchedRequestType, studentResidencyType, lang, t]);

  const onSubmit = async (values: FormDataValues) => {
    // 0. Client-side duplicate check guard
    if (hasActiveRequest) {
      toast.error(t("active_request_exists"));
      return;
    }

    setSaving(true);
    try {
      // 1. Validation for return_ticket
      if (values.request_type === "return_ticket") {
        if (!currentSettings.is_ticket_window_open) {
          toast.error(t("ticket_window_closed"));
          setSaving(false);
          return;
        }
        if (!values.destination) {
          toast.error(t("select_destination"));
          setSaving(false);
          return;
        }
        if (!values.departure_date) {
          toast.error(t("departure_date"));
          setSaving(false);
          return;
        }
        if (values.trip_type === "round_trip" && !values.return_date) {
          toast.error(t("return_date"));
          setSaving(false);
          return;
        }
      }

      // 2. Validation for update_passport
      if (values.request_type === "update_passport") {
        if (!values.new_passport_number) {
          toast.error(t("new_passport_number"));
          setSaving(false);
          return;
        }
        if (!values.date_of_issue) {
          toast.error(t("date_of_issue"));
          setSaving(false);
          return;
        }
        if (!values.date_of_expiry) {
          toast.error(t("date_of_expiry"));
          setSaving(false);
          return;
        }
        if (!values.issuing_office) {
          toast.error(t("issuing_office"));
          setSaving(false);
          return;
        }
        if (!values.passport_file) {
          toast.error(t("new_passport_file"));
          setSaving(false);
          return;
        }
      }

      // 3. Validation for exit_reentry_visa
      if (values.request_type === "exit_reentry_visa") {
        if (studentResidencyType !== "IQOMAH") {
          toast.error(
            lang === "ar"
              ? "تأشيرة خروج وعودة متاحة فقط للطلاب حاملي الإقامة."
              : "Exit/Re-entry Visa is only available for students holding an Iqomah."
          );
          setSaving(false);
          return;
        }
        if (values.visa_validity_type === "return_before" && !values.return_to_ksa_before) {
          toast.error(t("return_to_ksa_before"));
          setSaving(false);
          return;
        }
        if (values.visa_validity_type === "duration_days" && !values.duration_days) {
          toast.error(t("duration_in_days"));
          setSaving(false);
          return;
        }
        if (visaValidityExceeded) {
          toast.error(t("visa_validity_exceeded_desc"));
          setSaving(false);
          return;
        }
      }

      // 4. Validation for letter_of_enrollment
      if (values.request_type === "letter_of_enrollment") {
        if (!values.addressed_to) {
          toast.error(t("addressed_to"));
          setSaving(false);
          return;
        }
        if (values.addressed_to === "Other" && !values.addressed_to_other?.trim()) {
          toast.error(t("specify_institution"));
          setSaving(false);
          return;
        }
        if (!values.letter_language) {
          toast.error(t("letter_language"));
          setSaving(false);
          return;
        }
        if (!values.delivery_method) {
          toast.error(t("delivery_method"));
          setSaving(false);
          return;
        }
      }

      let dynamicDataPayload: any = null;
      let attachmentsPayload: string[] = values.attachment_file_ids;

      if (values.request_type === "return_ticket") {
        dynamicDataPayload = {
          origin: "Hail (HAS)",
          destination: values.destination,
          trip_type: values.trip_type,
          departure_date: values.departure_date,
          return_date: values.trip_type === "round_trip" ? values.return_date : null,
        };
        attachmentsPayload = [];
      } else if (values.request_type === "update_passport") {
        dynamicDataPayload = {
          new_passport_number: values.new_passport_number,
          date_of_issue: values.date_of_issue,
          date_of_expiry: values.date_of_expiry,
          issuing_office: values.issuing_office,
          passport_file: values.passport_file,
          passport_file_id: values.passport_file,
        };
        attachmentsPayload = values.passport_file ? [values.passport_file] : [];
      } else if (values.request_type === "exit_reentry_visa") {
        dynamicDataPayload = {
          visa_validity_type: values.visa_validity_type,
          return_to_ksa_before:
            values.visa_validity_type === "return_before" ? values.return_to_ksa_before : null,
          duration_days:
            values.visa_validity_type === "duration_days" ? Number(values.duration_days) : null,
          resident_id_expiry: studentResidencyExpiry,
        };
      } else if (values.request_type === "letter_of_enrollment") {
        dynamicDataPayload = {
          addressed_to: values.addressed_to,
          addressed_to_other: values.addressed_to === "Other" ? values.addressed_to_other.trim() : null,
          letter_language: values.letter_language,
          delivery_method: values.delivery_method,
        };
        attachmentsPayload = [];
      } else if (values.request_type === "iqomah_renewal") {
        dynamicDataPayload = null;
        attachmentsPayload = [];
      }

      const payload = {
        request_type: values.request_type,
        notes: values.notes,
        attachment_file_ids: attachmentsPayload,
        dynamic_data: dynamicDataPayload,
      };

      await api.post("/documents", payload);
      toast.success(lang === "ar" ? "تم إرسال الطلب بنجاح" : "Request submitted successfully");
      onOpenChange(false);
      reset({
        request_type: "iqomah_renewal",
        notes: "",
        attachment_file_ids: [],
        origin: "Hail (HAS)",
        destination: "",
        trip_type: "round_trip",
        departure_date: "",
        return_date: "",
        new_passport_number: "",
        date_of_issue: "",
        date_of_expiry: "",
        issuing_office: "",
        passport_file: null,
        visa_validity_type: "return_before",
        return_to_ksa_before: "",
        duration_days: "",
        addressed_to: "Bank",
        addressed_to_other: "",
        letter_language: "ar",
        delivery_method: "softcopy",
      });
      onSuccess?.();
    } catch (e) {
      const errMsg = axios.isAxiosError(e)
        ? e.response?.data?.message || e.response?.data?.detail
        : undefined;
      toast.error(formatApiError(errMsg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("new_document_request")}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 pt-2"
          data-testid="document-form"
        >
          {/* Document Type Dropdown */}
          <div className="space-y-1.5">
            <Label>{t("request_type")}</Label>
            <Select
              value={watchedRequestType}
              onValueChange={(v) => setValue("request_type", v)}
            >
              <SelectTrigger data-testid="request-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableDocumentTypes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "iqomah_renewal" &&
                    studentResidencyType === "STUDENT_VISA"
                      ? lang === "ar"
                        ? "تجديد تأشيرة الطالب"
                        : "Student Visa Renewal"
                      : t(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Client-Side Active Duplicate Warning Alert */}
            {hasActiveRequest && (
              <Alert
                variant="warning"
                className="border-amber-300 bg-amber-50 text-amber-900 mt-2"
                data-testid="active-request-alert"
              >
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="font-semibold text-amber-900 text-xs">
                  {t("active_request_exists")}
                </AlertTitle>
                <AlertDescription className="text-xs leading-relaxed text-amber-800 mt-1">
                  {lang === "ar"
                    ? `لديك حالياً طلب (${selectedDocTypeName}) قيد المعالجة. لا يمكنك إنشاء طلب جديد من نفس النوع.`
                    : `You already have an active request for (${selectedDocTypeName}) being processed. You cannot create a new request of the same type.`}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Dynamic Section: Update Passport (تحديث الجواز) */}
          {watchedRequestType === "update_passport" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <CreditCard className="h-4 w-4" />
                <span>{t("update_passport")}</span>
              </div>

              {/* 1. New Passport Number */}
              <div className="space-y-1.5">
                <Label>
                  {t("new_passport_number")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. A12345678"
                  required
                  {...register("new_passport_number", {
                    required: watchedRequestType === "update_passport",
                  })}
                  data-testid="new-passport-number-input"
                />
              </div>

              {/* 2 & 3. Issue Date & Expiry Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {t("date_of_issue")}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watch("date_of_issue")}
                    onChange={(d) => setValue("date_of_issue", d, { shouldValidate: true })}
                    placeholder={t("date_of_issue")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t("date_of_expiry")}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watch("date_of_expiry")}
                    onChange={(d) => setValue("date_of_expiry", d, { shouldValidate: true })}
                    placeholder={t("date_of_expiry")}
                  />
                </div>
              </div>

              {/* 4. Issuing Office */}
              <div className="space-y-1.5">
                <Label>
                  {t("issuing_office")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Jakarta, Riyadh, Cairo..."
                  required
                  {...register("issuing_office", {
                    required: watchedRequestType === "update_passport",
                  })}
                  data-testid="passport-issuing-office-input"
                />
              </div>

              {/* 5. Passport File Upload */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("new_passport_file")}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <FileUpload
                  kind="passport"
                  value={watchedPassportFile}
                  onChange={(id: string | null) => setValue("passport_file", id)}
                  label={t("new_passport_file")}
                />
              </div>
            </div>
          )}

          {/* Dynamic Section: Exit/Re-entry Visa (تأشيرة خروج وعودة) */}
          {watchedRequestType === "exit_reentry_visa" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <Plane className="h-4 w-4" />
                <span>{t("exit_reentry_visa")} · {t("visa_validity")}</span>
              </div>

              {/* Iqomah Validity Notice */}
              <Alert variant="warning" className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs leading-relaxed text-amber-800">
                  {lang === "ar"
                    ? `يرجى ملاحظة أن مدة التأشيرة لا يمكن أن تتجاوز صلاحية هوية مقيم (الإقامة). تاريخ انتهاء هوية الإقامة هو (${studentResidencyExpiry}).`
                    : `Please note that the visa duration cannot exceed the Resident ID Validity. The resident ID will Expire on (${studentResidencyExpiry}).`}
                </AlertDescription>
              </Alert>

              {/* Visa Validity Type Radio */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">{t("visa_validity")}</Label>
                <RadioGroup
                  value={watchedVisaValidityType}
                  onValueChange={(v) =>
                    setValue("visa_validity_type", v as "return_before" | "duration_days")
                  }
                  className="flex flex-col sm:flex-row gap-4 pt-1"
                  data-testid="visa-validity-type-radio"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="return_before" id="vv-return-before" />
                    <Label htmlFor="vv-return-before" className="cursor-pointer font-normal text-sm">
                      {t("return_to_ksa_before")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="duration_days" id="vv-duration-days" />
                    <Label htmlFor="vv-duration-days" className="cursor-pointer font-normal text-sm">
                      {t("duration_in_days")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Option 1: Return to KSA before DatePicker */}
              {watchedVisaValidityType === "return_before" ? (
                <div className="space-y-1.5" data-testid="visa-return-before-wrapper">
                  <Label className="text-xs font-medium">
                    {t("return_to_ksa_before")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watchedReturnToKsaBefore}
                    onChange={(d) => setValue("return_to_ksa_before", d, { shouldValidate: true })}
                    minDate={new Date().toISOString().split("T")[0]}
                    maxDate={iqomahExpiryDate || undefined}
                    placeholder={t("return_to_ksa_before")}
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    {t("return_to_ksa_before_desc")}
                  </p>
                </div>
              ) : (
                /* Option 2: Duration in Days Input */
                <div className="space-y-1.5" data-testid="visa-duration-days-wrapper">
                  <Label className="text-xs font-medium">
                    {t("duration_in_days")} <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={daysRemainingInIqomah !== null ? daysRemainingInIqomah : 365}
                    placeholder="e.g. 30, 60, 90..."
                    value={watchedDurationDays}
                    onChange={(e) => setValue("duration_days", e.target.value)}
                    data-testid="visa-duration-days-input"
                  />
                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    {t("duration_in_days_desc")}
                  </p>
                </div>
              )}

              {/* Alert when visa validity exceeds Iqomah validity */}
              {visaValidityExceeded && (
                <Alert
                  variant="destructive"
                  className="border-red-300 bg-red-50 text-red-900 mt-2"
                  data-testid="visa-validity-exceeded-alert"
                >
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertTitle className="font-semibold text-red-900 text-xs">
                    {t("visa_validity_exceeded_title")}
                  </AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed text-red-800 mt-1">
                    {lang === "ar"
                      ? `مدة أو تاريخ صلاحية التأشيرة المطلوبة تتجاوز تاريخ انتهاء صلاحية الإقامة (${studentResidencyExpiry}). يرجى اختيار تاريخ قبل انتهاء الإقامة أو مدة لا تتجاوز ${daysRemainingInIqomah !== null ? daysRemainingInIqomah : ""} يوماً.`
                      : `The requested visa validity exceeds your Iqomah expiration date (${studentResidencyExpiry}). Please select a date prior to Iqomah expiry or a duration not exceeding ${daysRemainingInIqomah !== null ? daysRemainingInIqomah : ""} days.`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Dynamic Section: Letter of Enrollment (خطاب قيد) */}
          {watchedRequestType === "letter_of_enrollment" && (
            <div
              className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              data-testid="letter-of-enrollment-section"
            >
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <FileText className="h-4 w-4" />
                <span>{t("letter_of_enrollment")}</span>
              </div>

              {/* 1. Addressed To (جهة التوجيه) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("addressed_to")} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={watchedAddressedTo}
                  onValueChange={(val) =>
                    setValue("addressed_to", val, { shouldValidate: true })
                  }
                >
                  <SelectTrigger data-testid="addressed-to-select">
                    <SelectValue placeholder={t("addressed_to")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bank">{t("bank")}</SelectItem>
                    <SelectItem value="Jawazat (Immigration)">
                      {t("jawazat")}
                    </SelectItem>
                    <SelectItem value="Embassy">{t("embassy")}</SelectItem>
                    <SelectItem value="Other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>

                {/* Conditional Text Input if "Other" is chosen */}
                {watchedAddressedTo === "Other" && (
                  <div className="pt-2 space-y-1.5" data-testid="addressed-to-other-wrapper">
                    <Label className="text-xs font-medium">
                      {t("specify_institution")} <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder={t("specify_institution")}
                      value={watchedAddressedToOther}
                      onChange={(e) =>
                        setValue("addressed_to_other", e.target.value, {
                          shouldValidate: true,
                        })
                      }
                      data-testid="addressed-to-other-input"
                    />
                  </div>
                )}
              </div>

              {/* 2. Letter Language (لغة الخطاب) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  {t("letter_language")} <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={watchedLetterLanguage}
                  onValueChange={(val) =>
                    setValue("letter_language", val as "ar" | "en", {
                      shouldValidate: true,
                    })
                  }
                  className="flex flex-col sm:flex-row gap-4 pt-1"
                  data-testid="letter-language-radio"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="ar" id="lang-ar-modal" />
                    <Label
                      htmlFor="lang-ar-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("arabic_lang")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="en" id="lang-en-modal" />
                    <Label
                      htmlFor="lang-en-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("english_lang")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* 3. Delivery Method (طريقة الاستلام) */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  {t("delivery_method")} <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={watchedDeliveryMethod}
                  onValueChange={(val) =>
                    setValue("delivery_method", val as "softcopy" | "hardcopy", {
                      shouldValidate: true,
                    })
                  }
                  className="flex flex-col sm:flex-row gap-4 pt-1"
                  data-testid="delivery-method-radio"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="softcopy" id="dm-softcopy-modal" />
                    <Label
                      htmlFor="dm-softcopy-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("softcopy")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="hardcopy" id="dm-hardcopy-modal" />
                    <Label
                      htmlFor="dm-hardcopy-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("hardcopy")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Dynamic Section: Pembaruan Dokumen (Iqomah / Visa) */}
          {watchedRequestType === "iqomah_renewal" && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{t("current_residency_expiry")}</span>
                </div>
                <div className="font-mono text-base font-bold text-slate-800">
                  {studentResidencyExpiry}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pt-1 border-t border-primary/10">
                {t("iqomah_renewal_request_desc")}
              </p>
            </div>
          )}

          {/* Dynamic Section: Tiket Pulang (Return Ticket) with Real-Time Date Picker */}
          {watchedRequestType === "return_ticket" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              {!currentSettings.is_ticket_window_open ? (
                <Alert
                  variant="warning"
                  className="border-amber-300 bg-amber-50 text-amber-900"
                  data-testid="ticket-window-alert"
                >
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="font-semibold text-amber-900">
                    {t("ticket_window_status")}
                  </AlertTitle>
                  <AlertDescription className="text-xs leading-relaxed text-amber-800 mt-1">
                    {t("ticket_window_closed")}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                    <Plane className="h-4 w-4" />
                    <span>{t("ticket_flight_details")}</span>
                  </div>

                  {/* Origin */}
                  <div className="space-y-1.5">
                    <Label>{t("origin")}</Label>
                    <Input
                      value="Hail (HAS)"
                      disabled
                      readOnly
                      className="bg-slate-100 font-medium cursor-not-allowed text-slate-700"
                      data-testid="ticket-origin-input"
                    />
                  </div>

                  {/* Destination Combobox */}
                  <div className="space-y-1.5">
                    <Label>
                      {t("destination")} <span className="text-red-500">*</span>
                    </Label>
                    <AirportCombobox
                      value={watchedDestination}
                      onChange={(val) =>
                        setValue("destination", val, { shouldValidate: true })
                      }
                    />
                    {errors.destination && (
                      <p className="text-xs text-red-500">
                        {t("select_destination")}
                      </p>
                    )}
                  </div>

                  {/* Trip Type */}
                  <div className="space-y-2">
                    <Label>{t("trip_type")}</Label>
                    <RadioGroup
                      value={watchedTripType}
                      onValueChange={(v) =>
                        setValue("trip_type", v as "one_way" | "round_trip")
                      }
                      className="flex items-center gap-6 pt-1"
                      data-testid="trip-type-radio"
                    >
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="round_trip" id="trip-rt-modal" />
                        <Label
                          htmlFor="trip-rt-modal"
                          className="cursor-pointer font-normal text-sm"
                        >
                          {t("round_trip")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <RadioGroupItem value="one_way" id="trip-ow-modal" />
                        <Label
                          htmlFor="trip-ow-modal"
                          className="cursor-pointer font-normal text-sm"
                        >
                          {t("one_way")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Conditional Rendering: Real-time Date Picker */}
                  {watchedTripType === "one_way" ? (
                    <div className="space-y-1.5" data-testid="single-date-picker-wrapper">
                      <Label>
                        {t("departure_date")}{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <DatePicker
                        value={watchedDepartureDate}
                        onChange={(d) =>
                          setValue("departure_date", d, { shouldValidate: true })
                        }
                        minDate={new Date().toISOString().split("T")[0]}
                        placeholder={t("departure_date")}
                      />
                      {errors.departure_date && (
                        <p className="text-xs text-red-500">
                          {t("departure_date")} required
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5" data-testid="range-date-picker-wrapper">
                      <Label>
                        {t("departure_and_return_date")}{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <DateRangePicker
                        from={watchedDepartureDate}
                        to={watchedReturnDate}
                        onChange={({ from, to }) => {
                          setValue("departure_date", from, { shouldValidate: true });
                          setValue("return_date", to, { shouldValidate: true });
                        }}
                        minDate={new Date().toISOString().split("T")[0]}
                        placeholder={t("departure_and_return_date")}
                      />
                      {(!watchedDepartureDate || !watchedReturnDate) && (
                        <p className="text-[11px] text-muted-foreground">
                          {lang === "ar"
                            ? "انقر لاختيار تاريخ المغادرة وتاريخ العودة معاً"
                            : "Click to select both departure and return dates on the calendar"}
                        </p>
                      )}
                    </div>
                  )}

                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    {t("auto_file_reference_note")}
                  </p>
                </>
              )}
            </div>
          )}

          {/* Notes input */}
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea
              rows={3}
              placeholder={t("notes")}
              {...register("notes")}
            />
          </div>

          {/* Attachment Form (Hidden for Return Ticket, Update Passport, Iqomah Renewal, and Letter of Enrollment) */}
          {watchedRequestType !== "return_ticket" &&
            watchedRequestType !== "update_passport" &&
            watchedRequestType !== "iqomah_renewal" &&
            watchedRequestType !== "letter_of_enrollment" && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("attachments")}
                </Label>
                <div className="space-y-2">
                  {watchedAttachments.map((fid, idx) => (
                    <FileUpload
                      key={fid + idx}
                      label=""
                      kind={`attachment-${idx}`}
                      value={fid}
                      onChange={(newId: string | null) => {
                        const arr = [...watchedAttachments];
                        if (newId) arr[idx] = newId;
                        else arr.splice(idx, 1);
                        setValue("attachment_file_ids", arr);
                      }}
                    />
                  ))}
                  <FileUpload
                    key={`new-${watchedAttachments.length}`}
                    kind={`attachment-new-${watchedAttachments.length}`}
                    value={null}
                    onChange={(id: string | null) =>
                      id &&
                      setValue("attachment_file_ids", [
                        ...watchedAttachments,
                        id,
                      ])
                    }
                    label={t("add_attachment")}
                  />
                </div>
              </div>
            )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                hasActiveRequest ||
                visaValidityExceeded ||
                (watchedRequestType === "return_ticket" &&
                  !currentSettings.is_ticket_window_open) ||
                (watchedRequestType === "letter_of_enrollment" &&
                  (!watchedAddressedTo ||
                    (watchedAddressedTo === "Other" && !watchedAddressedToOther?.trim()) ||
                    !watchedLetterLanguage ||
                    !watchedDeliveryMethod))
              }
              data-testid="document-submit"
            >
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
