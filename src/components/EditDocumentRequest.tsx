"use client";

import React, { useState, useEffect } from "react";
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
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DatePicker, DateRangePicker, parseISODate } from "@/components/ui/date-picker";
import { AirportCombobox } from "@/components/AirportCombobox";
import FileUpload from "@/components/FileUpload";
import type { DocumentRequestItem, StudentProfileData } from "./NewDocumentRequest";
import {
  AlertCircle,
  CreditCard,
  Paperclip,
  ShieldCheck,
  Plane,
  FileText,
} from "lucide-react";

export interface EditDocumentRequestProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: DocumentRequestItem | null;
  studentProfile?: StudentProfileData | null;
  systemSettings?: { is_ticket_window_open: boolean };
  onSuccess?: () => void;
}

interface EditFormDataValues {
  notes: string;
  attachment_file_ids: string[];
  destination: string;
  trip_type: "one_way" | "round_trip";
  departure_date: string;
  return_date: string;
  new_passport_number: string;
  date_of_issue: string;
  date_of_expiry: string;
  issuing_office: string;
  passport_file: string | null;
  visa_validity_type: "return_before" | "duration_days";
  return_to_ksa_before: string;
  duration_days: number | string;
  // Dynamic fields for letter_of_enrollment
  addressed_to: string;
  addressed_to_other: string;
  letter_language: "ar" | "en";
  delivery_method: "softcopy" | "hardcopy";
}

export function EditDocumentRequest({
  open,
  onOpenChange,
  document: doc,
  studentProfile,
  systemSettings,
  onSuccess,
}: EditDocumentRequestProps) {
  const { t, lang } = useI18n();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<EditFormDataValues>({
    defaultValues: {
      notes: "",
      attachment_file_ids: [],
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

  // Populate form with existing document data when opened
  useEffect(() => {
    if (doc && open) {
      const dyn = doc.dynamic_data || {};
      reset({
        notes: doc.notes || "",
        attachment_file_ids: doc.attachment_file_ids || [],
        destination: dyn.destination || "",
        trip_type: dyn.trip_type || "round_trip",
        departure_date: dyn.departure_date || "",
        return_date: dyn.return_date || "",
        new_passport_number: dyn.new_passport_number || "",
        date_of_issue: dyn.date_of_issue || "",
        date_of_expiry: dyn.date_of_expiry || "",
        issuing_office: dyn.issuing_office || "",
        passport_file: dyn.passport_file || dyn.passport_file_id || null,
        visa_validity_type: dyn.visa_validity_type || "return_before",
        return_to_ksa_before: dyn.return_to_ksa_before || "",
        duration_days: dyn.duration_days != null ? String(dyn.duration_days) : "",
        addressed_to: dyn.addressed_to || "Bank",
        addressed_to_other: dyn.addressed_to_other || "",
        letter_language: dyn.letter_language || "ar",
        delivery_method: dyn.delivery_method || "softcopy",
      });
    }
  }, [doc, open, reset]);

  if (!doc) return null;

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

  const studentResidencyExpiry =
    studentProfile?.residency_expiry ||
    studentProfile?.residencyExpiry ||
    "—";

  const iqomahExpiryDate = React.useMemo(() => {
    const raw = studentProfile?.residency_expiry || studentProfile?.residencyExpiry;
    if (!raw || raw === "—") return null;
    return raw;
  }, [studentProfile]);

  const daysRemainingInIqomah = React.useMemo(() => {
    if (!iqomahExpiryDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const expDate = parseISODate(iqomahExpiryDate);
    if (!expDate) return null;
    return Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }, [iqomahExpiryDate]);

  const visaValidityExceeded = React.useMemo(() => {
    if (doc.request_type !== "exit_reentry_visa" || !iqomahExpiryDate) {
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
    doc.request_type,
    iqomahExpiryDate,
    watchedVisaValidityType,
    watchedReturnToKsaBefore,
    watchedDurationDays,
    daysRemainingInIqomah,
  ]);

  const onSubmit = async (values: EditFormDataValues) => {
    setSaving(true);
    try {
      let dynamicDataPayload: any = doc.dynamic_data || null;
      let attachmentsPayload: string[] = values.attachment_file_ids;

      if (doc.request_type === "return_ticket") {
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
        dynamicDataPayload = {
          origin: "Hail (HAS)",
          destination: values.destination,
          trip_type: values.trip_type,
          departure_date: values.departure_date,
          return_date: values.trip_type === "round_trip" ? values.return_date : null,
        };
        attachmentsPayload = [];
      } else if (doc.request_type === "update_passport") {
        if (!values.new_passport_number || !values.date_of_issue || !values.date_of_expiry || !values.issuing_office) {
          toast.error("Please fill in all passport fields");
          setSaving(false);
          return;
        }
        dynamicDataPayload = {
          new_passport_number: values.new_passport_number,
          date_of_issue: values.date_of_issue,
          date_of_expiry: values.date_of_expiry,
          issuing_office: values.issuing_office,
          passport_file: values.passport_file,
          passport_file_id: values.passport_file,
        };
        attachmentsPayload = values.passport_file ? [values.passport_file] : [];
      } else if (doc.request_type === "exit_reentry_visa") {
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
        dynamicDataPayload = {
          visa_validity_type: values.visa_validity_type,
          return_to_ksa_before:
            values.visa_validity_type === "return_before" ? values.return_to_ksa_before : null,
          duration_days:
            values.visa_validity_type === "duration_days" ? Number(values.duration_days) : null,
          resident_id_expiry: studentResidencyExpiry,
        };
      } else if (doc.request_type === "letter_of_enrollment") {
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
        dynamicDataPayload = {
          addressed_to: values.addressed_to,
          addressed_to_other: values.addressed_to === "Other" ? values.addressed_to_other.trim() : null,
          letter_language: values.letter_language,
          delivery_method: values.delivery_method,
        };
        attachmentsPayload = [];
      }

      const payload = {
        notes: values.notes,
        attachment_file_ids: attachmentsPayload,
        dynamic_data: dynamicDataPayload,
      };

      await api.patch(`/documents/${doc.id}`, payload);
      toast.success(t("request_updated_success"));
      onOpenChange(false);
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
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pe-6">
            <DialogTitle>{t("edit_request")}</DialogTitle>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {t(doc.request_type)}
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Dynamic Section: Update Passport */}
          {doc.request_type === "update_passport" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <CreditCard className="h-4 w-4" />
                <span>{t("update_passport")}</span>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t("new_passport_number")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. A12345678"
                  required
                  {...register("new_passport_number", { required: true })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {t("date_of_issue")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watch("date_of_issue")}
                    onChange={(d) => setValue("date_of_issue", d, { shouldValidate: true })}
                    placeholder={t("date_of_issue")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t("date_of_expiry")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watch("date_of_expiry")}
                    onChange={(d) => setValue("date_of_expiry", d, { shouldValidate: true })}
                    placeholder={t("date_of_expiry")}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t("issuing_office")} <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Jakarta, Riyadh, Cairo..."
                  required
                  {...register("issuing_office", { required: true })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5" />
                  {t("new_passport_file")}
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

          {/* Dynamic Section: Return Ticket */}
          {doc.request_type === "return_ticket" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <Plane className="h-4 w-4" />
                <span>{t("ticket_flight_details")}</span>
              </div>

              <div className="space-y-1.5">
                <Label>{t("origin")}</Label>
                <Input
                  value="Hail (HAS)"
                  disabled
                  readOnly
                  className="bg-slate-100 font-medium cursor-not-allowed text-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  {t("destination")} <span className="text-red-500">*</span>
                </Label>
                <AirportCombobox
                  value={watchedDestination}
                  onChange={(val) => setValue("destination", val, { shouldValidate: true })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("trip_type")}</Label>
                <RadioGroup
                  value={watchedTripType}
                  onValueChange={(v) => setValue("trip_type", v as "one_way" | "round_trip")}
                  className="flex items-center gap-6 pt-1"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="round_trip" id="edit-trip-rt" />
                    <Label htmlFor="edit-trip-rt" className="cursor-pointer font-normal text-sm">
                      {t("round_trip")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="one_way" id="edit-trip-ow" />
                    <Label htmlFor="edit-trip-ow" className="cursor-pointer font-normal text-sm">
                      {t("one_way")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {watchedTripType === "one_way" ? (
                <div className="space-y-1.5">
                  <Label>
                    {t("departure_date")} <span className="text-red-500">*</span>
                  </Label>
                  <DatePicker
                    value={watchedDepartureDate}
                    onChange={(d) => setValue("departure_date", d, { shouldValidate: true })}
                    minDate={new Date().toISOString().split("T")[0]}
                    placeholder={t("departure_date")}
                  />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>
                    {t("departure_and_return_date")} <span className="text-red-500">*</span>
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
                </div>
              )}
            </div>
          )}

          {/* Dynamic Section: Exit/Re-entry Visa */}
          {doc.request_type === "exit_reentry_visa" && (
            <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs border-b border-slate-200 pb-2">
                <Plane className="h-4 w-4" />
                <span>{t("exit_reentry_visa")} · {t("visa_validity")}</span>
              </div>

              <Alert variant="warning" className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs leading-relaxed text-amber-800">
                  {lang === "ar"
                    ? `يرجى ملاحظة أن مدة التأشيرة لا يمكن أن تتجاوز صلاحية هوية مقيم (الإقامة). تاريخ انتهاء هوية الإقامة هو (${studentResidencyExpiry}).`
                    : `Please note that the visa duration cannot exceed the Resident ID Validity. The resident ID will Expire on (${studentResidencyExpiry}).`}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">{t("visa_validity")}</Label>
                <RadioGroup
                  value={watchedVisaValidityType}
                  onValueChange={(v) =>
                    setValue("visa_validity_type", v as "return_before" | "duration_days")
                  }
                  className="flex flex-col sm:flex-row gap-4 pt-1"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="return_before" id="edit-vv-return-before" />
                    <Label htmlFor="edit-vv-return-before" className="cursor-pointer font-normal text-sm">
                      {t("return_to_ksa_before")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="duration_days" id="edit-vv-duration-days" />
                    <Label htmlFor="edit-vv-duration-days" className="cursor-pointer font-normal text-sm">
                      {t("duration_in_days")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {watchedVisaValidityType === "return_before" ? (
                <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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
                  data-testid="edit-visa-validity-exceeded-alert"
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
          {doc.request_type === "letter_of_enrollment" && (
            <div
              className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
              data-testid="edit-letter-of-enrollment-section"
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
                  <SelectTrigger data-testid="edit-addressed-to-select">
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
                  <div className="pt-2 space-y-1.5" data-testid="edit-addressed-to-other-wrapper">
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
                      data-testid="edit-addressed-to-other-input"
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
                  data-testid="edit-letter-language-radio"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="ar" id="edit-lang-ar-modal" />
                    <Label
                      htmlFor="edit-lang-ar-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("arabic_lang")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="en" id="edit-lang-en-modal" />
                    <Label
                      htmlFor="edit-lang-en-modal"
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
                  data-testid="edit-delivery-method-radio"
                >
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="softcopy" id="edit-dm-softcopy-modal" />
                    <Label
                      htmlFor="edit-dm-softcopy-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("softcopy")}
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <RadioGroupItem value="hardcopy" id="edit-dm-hardcopy-modal" />
                    <Label
                      htmlFor="edit-dm-hardcopy-modal"
                      className="cursor-pointer font-normal text-sm"
                    >
                      {t("hardcopy")}
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          )}

          {/* Dynamic Section: Iqomah Renewal */}
          {doc.request_type === "iqomah_renewal" && (
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t("notes")}</Label>
            <Textarea rows={3} placeholder={t("notes")} {...register("notes")} />
          </div>

          {/* Attachments for other types */}
          {doc.request_type !== "return_ticket" &&
            doc.request_type !== "update_passport" &&
            doc.request_type !== "iqomah_renewal" &&
            doc.request_type !== "letter_of_enrollment" && (
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
                      kind={`edit-att-${idx}`}
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
                    key={`edit-new-${watchedAttachments.length}`}
                    kind={`edit-att-new-${watchedAttachments.length}`}
                    value={null}
                    onChange={(id: string | null) =>
                      id && setValue("attachment_file_ids", [...watchedAttachments, id])
                    }
                    label={t("add_attachment")}
                  />
                </div>
              </div>
            )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                visaValidityExceeded ||
                (doc.request_type === "letter_of_enrollment" &&
                  (!watchedAddressedTo ||
                    (watchedAddressedTo === "Other" && !watchedAddressedToOther?.trim()) ||
                    !watchedLetterLanguage ||
                    !watchedDeliveryMethod))
              }
            >
              {saving ? t("updating") : t("save_changes")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
