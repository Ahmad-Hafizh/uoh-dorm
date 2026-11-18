"use client";

import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationsContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import {
  Plus,
  CalendarCheck,
  AlertTriangle,
  Car,
  Home,
  Navigation,
  CheckCircle2,
  Clock,
  Pencil,
  Check,
  X,
  XCircle,
  MapPin,
  MapPinOff,
  RotateCcw,
  Sliders,
  FileText,
  Search,
} from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { FileThumb } from "@/components/FilePreview";
import { toast } from "sonner";

const PERMISSION_TYPES = ["OUT_OF_TOWN", "OVERNIGHT", "VACATION"] as const;
const PERMISSION_STATUSES = [
  "PENDING",
  "APPROVED",
  "ACTIVE",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
] as const;

export type PermissionType = (typeof PERMISSION_TYPES)[number];
export type PermissionStatus = (typeof PERMISSION_STATUSES)[number];

export interface Permission {
  id: string;
  user_id: string;
  user_name: string;
  permission_type: string;
  destination?: string | null;
  transportation_mode?: string | null;
  overnight_address?: string | null;
  emergency_contact?: string | null;
  ticket_attachment_id?: string | null;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  admin_note: string;
  created_at: string;
  updated_at?: string | null;
}

export interface GeofenceSettings {
  enabled: boolean;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

export interface PermissionSettings {
  default_approval_note: string;
}

const DEFAULT_NOTES: Record<"en" | "ar", string> = {
  en: "Permission approved. Wishing you a safe trip and a safe return, fee amani Allah.",
  ar: "تمت الموافقة على طلب الإذن، رافقتكم السلامة وعودًا حميدًا بحفظ الله ورعايته",
};

const defaultGeofence: GeofenceSettings = {
  enabled: true,
  name: "University of Hail Student Housing",
  latitude: 27.545,
  longitude: 41.71,
  radius_meters: 500,
};

const defaultSettings: PermissionSettings = {
  default_approval_note: DEFAULT_NOTES.en,
};

const isDefaultOrLegacyNote = (note?: string | null): boolean => {
  if (!note || !note.trim()) return true;
  if (note.includes("Izin sudah disetujui")) return true;
  if (note === DEFAULT_NOTES.en || note === DEFAULT_NOTES.ar) return true;
  return false;
};

const permissionFormSchema = z
  .object({
    permission_type: z.enum(["OUT_OF_TOWN", "OVERNIGHT", "VACATION"]),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    reason: z.string().trim().min(1, "Reason is required"),
    destination: z.string().optional().nullable(),
    transportation_mode: z.string().optional().nullable(),
    overnight_address: z.string().optional().nullable(),
    emergency_contact: z.string().optional().nullable(),
    ticket_attachment_id: z.string().optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
      }
      return true;
    },
    {
      message: "End date must be on or after start date",
      path: ["end_date"],
    }
  )
  .refine(
    (data) => {
      if (data.permission_type === "OUT_OF_TOWN") {
        return !!data.destination && data.destination.trim().length > 0;
      }
      return true;
    },
    {
      message: "Destination is required for out of town trips",
      path: ["destination"],
    }
  )
  .refine(
    (data) => {
      if (data.permission_type === "OVERNIGHT") {
        return (
          !!data.overnight_address && data.overnight_address.trim().length > 0
        );
      }
      return true;
    },
    {
      message: "Overnight address is required",
      path: ["overnight_address"],
    }
  );

type PermissionFormData = z.infer<typeof permissionFormSchema>;

// Custom Zod resolver to avoid external resolver dependency issues
const customZodResolver =
  (schema: z.ZodType<any>) => async (data: PermissionFormData) => {
    const result = schema.safeParse(data);
    if (result.success) {
      return { values: result.data, errors: {} };
    }
    const errors: Record<string, any> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as string;
      if (!errors[field]) {
        errors[field] = { type: issue.code, message: issue.message };
      }
    }
    return { values: {}, errors };
  };

// Haversine formula to calculate distance between two coordinates in meters
function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function statusBadge(status: string, t: (key: string) => string) {
  const norm = (status || "").toUpperCase();
  const map: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 border-amber-200",
    APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
    ACTIVE: "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold",
    COMPLETED: "bg-slate-100 text-slate-800 border-slate-200",
    REJECTED: "bg-red-100 text-red-800 border-red-200",
    CANCELLED: "bg-slate-100 text-slate-700 border-slate-300",
  };
  return (
    <Badge
      variant="outline"
      className={map[norm] || "bg-slate-100 text-slate-700"}
    >
      {t(norm) || t(status.toLowerCase()) || status}
    </Badge>
  );
}

export default function Permissions() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { markRead, refresh: refreshNotifications } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const isAdmin = !!user && user.role === "admin";

  const [rows, setRows] = useState<Permission[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [edit, setEdit] = useState<Permission | null>(null);
  const [studentEditTarget, setStudentEditTarget] = useState<Permission | null>(
    null
  );
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [iqomahExpiry, setIqomahExpiry] = useState<string | null>(null);

  // Staff/Admin Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");

  // Shortcut Reject Modal states
  const [rejectTarget, setRejectTarget] = useState<Permission | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [savingReject, setSavingReject] = useState(false);

  // Student Cancel Trip Modal states
  const [cancellingPermission, setCancellingPermission] = useState<Permission | null>(null);
  const [cancellingLoading, setCancellingLoading] = useState(false);

  // Admin Settings states (Approval Note & Geofencing)
  const [openAdminSettings, setOpenAdminSettings] = useState(false);
  const [permissionSettings, setPermissionSettings] =
    useState<PermissionSettings>({
      default_approval_note: DEFAULT_NOTES[lang] || DEFAULT_NOTES.en,
    });
  const [defaultNoteForm, setDefaultNoteForm] = useState(
    DEFAULT_NOTES[lang] || DEFAULT_NOTES.en
  );
  const [geofenceSettings, setGeofenceSettings] =
    useState<GeofenceSettings>(defaultGeofence);
  const [geofenceForm, setGeofenceForm] =
    useState<GeofenceSettings>(defaultGeofence);
  const [savingSettings, setSavingSettings] = useState(false);

  // Student Outside Geofence Alert state
  const [outsideGeofenceInfo, setOutsideGeofenceInfo] = useState<{
    distance: number;
    maxRadius: number;
    dormName: string;
    permissionId: string;
  } | null>(null);

  // React Hook Form setup for New Permission
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<PermissionFormData>({
    resolver: customZodResolver(permissionFormSchema),
    defaultValues: {
      permission_type: "OUT_OF_TOWN",
      destination: "",
      transportation_mode: "bus",
      overnight_address: "",
      emergency_contact: "",
      ticket_attachment_id: null,
      start_date: "",
      end_date: "",
      reason: "",
    },
  });

  // React Hook Form setup for Student Edit (Pending)
  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    control: controlEdit,
    watch: watchEdit,
    setValue: setValueEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
  } = useForm<PermissionFormData>({
    resolver: customZodResolver(permissionFormSchema),
  });

  const watchedType = watch("permission_type");
  const watchedStartDate = watch("start_date");
  const watchedTicket = watch("ticket_attachment_id");

  const watchedEditType = watchEdit("permission_type");
  const watchedEditTicket = watchEdit("ticket_attachment_id");

  // Fetch Geofence and Permission Settings
  const loadSettings = async () => {
    try {
      const [resGeo, resPerm] = await Promise.allSettled([
        api.get("/settings/geofence"),
        api.get("/settings/permissions"),
      ]);

      if (resGeo.status === "fulfilled" && resGeo.value.data) {
        setGeofenceSettings(resGeo.value.data);
        setGeofenceForm(resGeo.value.data);
      }
      if (resPerm.status === "fulfilled" && resPerm.value.data?.default_approval_note) {
        let note = resPerm.value.data.default_approval_note;
        if (isDefaultOrLegacyNote(note)) {
          note = DEFAULT_NOTES[lang] || DEFAULT_NOTES.en;
        }
        setPermissionSettings({ default_approval_note: note });
        setDefaultNoteForm(note);
      }
    } catch {
      // Use defaults
    }
  };

  // Sync default approval note when app language changes
  useEffect(() => {
    setPermissionSettings((prev) => {
      if (isDefaultOrLegacyNote(prev.default_approval_note)) {
        return { default_approval_note: DEFAULT_NOTES[lang] || DEFAULT_NOTES.en };
      }
      return prev;
    });
    setDefaultNoteForm((prev) => {
      if (isDefaultOrLegacyNote(prev)) {
        return DEFAULT_NOTES[lang] || DEFAULT_NOTES.en;
      }
      return prev;
    });
  }, [lang]);

  // Fetch student profile for Iqomah Expiry validation
  useEffect(() => {
    loadSettings();
    if (user && user.role === "student") {
      api
        .get("/students/me")
        .then((res) => {
          if (res.data?.iqomah_expiry) {
            setIqomahExpiry(res.data.iqomah_expiry);
          }
        })
        .catch(() => {
          api
            .get("/dashboard/student")
            .then((res) => {
              if (res.data?.profile?.iqomah_expiry) {
                setIqomahExpiry(res.data.profile.iqomah_expiry);
              }
            })
            .catch(() => {});
        });
    }
  }, [user]);

  // Iqomah 3-month validation for VACATION
  const isIqomahExpiringSoon = useMemo(() => {
    if (watchedType !== "VACATION" || !iqomahExpiry) return false;
    const baseDate = watchedStartDate ? new Date(watchedStartDate) : new Date();
    const expDate = new Date(iqomahExpiry);
    const diffTime = expDate.getTime() - baseDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays < 90;
  }, [watchedType, watchedStartDate, iqomahExpiry]);

  const load = async () => {
    try {
      const res = await api.get("/permissions");
      setRows(res.data);
      refreshNotifications();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    }
  };

  useEffect(() => {
    load();
    if (user && user.role === "student") markRead("permissions");
    // eslint-disable-next-line
  }, [user]);

  const onSubmit = async (data: PermissionFormData) => {
    setSaving(true);
    try {
      await api.post("/permissions", data);
      toast.success(t("submit") + " OK");
      setOpenNew(false);
      reset({
        permission_type: "OUT_OF_TOWN",
        destination: "",
        transportation_mode: "bus",
        overnight_address: "",
        emergency_contact: "",
        ticket_attachment_id: null,
        start_date: "",
        end_date: "",
        reason: "",
      });
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // Student Edit Dialog Open
  const openEditDialogForStudent = (perm: Permission) => {
    setStudentEditTarget(perm);
    resetEdit({
      permission_type: (perm.permission_type as any) || "OUT_OF_TOWN",
      destination: perm.destination || "",
      transportation_mode: perm.transportation_mode || "bus",
      overnight_address: perm.overnight_address || "",
      emergency_contact: perm.emergency_contact || "",
      ticket_attachment_id: perm.ticket_attachment_id || null,
      start_date: perm.start_date || "",
      end_date: perm.end_date || "",
      reason: perm.reason || "",
    });
  };

  // Student Submit Edit
  const onSubmitStudentEdit = async (data: PermissionFormData) => {
    if (!studentEditTarget) return;
    setSaving(true);
    try {
      await api.patch(`/permissions/${studentEditTarget.id}`, data);
      toast.success(t("permission_updated"));
      setStudentEditTarget(null);
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // Staff Review Dialog Submit
  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/permissions/${edit.id}`, {
        status: edit.status,
        admin_note: edit.admin_note,
      });
      toast.success("Updated");
      setEdit(null);
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setSaving(false);
    }
  };

  // Staff Shortcut 1: One-Click Approve with Localized Default Admin Note
  const handleQuickStaffApprove = async (permissionId: string) => {
    setActionLoadingId(permissionId);
    try {
      const currentNote = permissionSettings.default_approval_note?.trim();
      const noteToSend = isDefaultOrLegacyNote(currentNote)
        ? DEFAULT_NOTES[lang] || DEFAULT_NOTES.en
        : currentNote!;

      await api.patch(`/permissions/${permissionId}`, {
        status: "APPROVED",
        admin_note: noteToSend,
      });
      toast.success(t("permission_approved_quick"));
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Staff Shortcut 2: Confirm Reject Modal Submit (Note is Optional)
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setSavingReject(true);
    try {
      await api.patch(`/permissions/${rejectTarget.id}`, {
        status: "REJECTED",
        admin_note: rejectNote.trim(),
      });
      toast.success(t("permission_rejected_quick"));
      setRejectTarget(null);
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setSavingReject(false);
    }
  };

  // Student Cancel Journey: Confirm Cancel Modal Submit
  const handleConfirmCancelTrip = async () => {
    if (!cancellingPermission) return;
    setCancellingLoading(true);
    try {
      await api.patch(`/permissions/${cancellingPermission.id}`, {
        status: "CANCELLED",
        admin_note: "Trip cancelled by student",
      });
      toast.success(t("trip_cancelled_success"));
      setCancellingPermission(null);
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setCancellingLoading(false);
    }
  };

  // Student Self Check-in ("Mulai Perjalanan": APPROVED -> ACTIVE)
  const handleStartJourney = async (permissionId: string) => {
    setActionLoadingId(permissionId);
    try {
      await api.patch(`/permissions/${permissionId}`, { status: "ACTIVE" });
      toast.success(t("start_journey") + " OK");
      load();
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setActionLoadingId(null);
    }
  };

  // Student Self Check-out ("Saya Sudah Kembali" / Arrived) with Geofencing Validation
  const handleStudentReturnWithGeofence = async (permissionId: string) => {
    setActionLoadingId(permissionId);
    try {
      let geo = geofenceSettings;
      try {
        const res = await api.get("/settings/geofence");
        if (res.data) {
          geo = res.data;
          setGeofenceSettings(res.data);
        }
      } catch {
        // Fallback to local state
      }

      // If geofencing is enabled, verify GPS coordinates
      if (geo && geo.enabled) {
        if (!("geolocation" in navigator)) {
          toast.error("Geolocation is not supported by your browser");
          setActionLoadingId(null);
          return;
        }

        toast.info(t("verifying_location"));

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const dist = getDistanceMeters(
              latitude,
              longitude,
              geo.latitude,
              geo.longitude
            );

            // Outside geofence radius!
            if (dist > geo.radius_meters) {
              setOutsideGeofenceInfo({
                distance: dist,
                maxRadius: geo.radius_meters,
                dormName: geo.name,
                permissionId,
              });
              setActionLoadingId(null);
              return;
            }

            // Inside geofence radius! Complete return
            try {
              await api.patch(`/permissions/${permissionId}`, {
                status: "COMPLETED",
                latitude,
                longitude,
                distance_meters: dist,
              });
              toast.success(t("location_verified") + ` (${dist}m)`);
              load();
            } catch (e) {
              toast.error(
                formatApiError(
                  axios.isAxiosError(e) ? e.response?.data?.detail : undefined
                )
              );
            } finally {
              setActionLoadingId(null);
            }
          },
          (error) => {
            setActionLoadingId(null);
            let msg = t("gps_error");
            if (error.code === error.PERMISSION_DENIED) {
              msg = t("gps_permission_denied");
            }
            toast.error(msg);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        // Geofencing is disabled, check-in directly
        await api.patch(`/permissions/${permissionId}`, { status: "COMPLETED" });
        toast.success(t("i_have_returned") + " OK");
        load();
        setActionLoadingId(null);
      }
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
      setActionLoadingId(null);
    }
  };

  // Admin Capture Current Location for Geofence
  const handleCaptureAdminLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported");
      return;
    }
    toast.info(t("acquiring_gps"));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeofenceForm((prev) => ({
          ...prev,
          latitude: parseFloat(pos.coords.latitude.toFixed(6)),
          longitude: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        toast.success(t("gps_acquired"));
      },
      () => {
        toast.error(t("gps_error"));
      },
      { enableHighAccuracy: true }
    );
  };

  // Save Admin Settings (Both Default Note & Geofencing)
  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const [resPerm, resGeo] = await Promise.all([
        api.patch("/settings/permissions", {
          default_approval_note: defaultNoteForm.trim(),
        }),
        api.patch("/settings/geofence", geofenceForm),
      ]);

      if (resPerm.data) {
        setPermissionSettings(resPerm.data);
      }
      if (resGeo.data) {
        setGeofenceSettings(resGeo.data);
      }
      toast.success(t("geofence_saved"));
      setOpenAdminSettings(false);
    } catch (e) {
      toast.error(
        formatApiError(
          axios.isAxiosError(e) ? e.response?.data?.detail : undefined
        )
      );
    } finally {
      setSavingSettings(false);
    }
  };

  // Determine if today is on or after start_date
  const isStartReached = (startDateStr: string) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return startDateStr.slice(0, 10) <= todayStr;
  };

  // Determine if 24 hours have passed since scheduled start_date (Auto Start Journey)
  const isPast24Hours = (startDateStr?: string | null): boolean => {
    if (!startDateStr) return false;
    const startMs = new Date(startDateStr.includes("T") ? startDateStr : `${startDateStr}T00:00:00`).getTime();
    return !isNaN(startMs) && Date.now() - startMs >= 24 * 60 * 60 * 1000;
  };

  // Determine if end_date has passed (Overdue / Overstay)
  const isPastEndDate = (endDateStr?: string | null): boolean => {
    if (!endDateStr) return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return endDateStr.slice(0, 10) < todayStr;
  };

  // Filtered rows for Staff/Admin
  const filteredStaffRows = useMemo(() => {
    return rows.filter((r) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchUser = r.user_name?.toLowerCase().includes(q);
        const matchDest = r.destination?.toLowerCase().includes(q);
        const matchAddr = r.overnight_address?.toLowerCase().includes(q);
        const matchReason = r.reason?.toLowerCase().includes(q);
        if (!matchUser && !matchDest && !matchAddr && !matchReason) {
          return false;
        }
      }
      if (filterStatus !== "ALL") {
        if ((r.status || "").toUpperCase() !== filterStatus) {
          return false;
        }
      }
      if (filterType !== "ALL") {
        if ((r.permission_type || "").toUpperCase() !== filterType) {
          return false;
        }
      }
      return true;
    });
  }, [rows, searchQuery, filterStatus, filterType]);

  // Grouped rows for Student
  const activeStudentRows = useMemo(() => {
    return rows.filter((r) =>
      ["PENDING", "APPROVED", "ACTIVE"].includes((r.status || "").toUpperCase())
    );
  }, [rows]);

  const historyStudentRows = useMemo(() => {
    return rows.filter((r) =>
      ["COMPLETED", "REJECTED", "CANCELLED"].includes((r.status || "").toUpperCase())
    );
  }, [rows]);

  // Render individual permission card
  const renderPermissionCard = (r: Permission) => {
    const normStatus = (r.status || "").toUpperCase();
    const normType = (r.permission_type || "").toUpperCase();
    const isAutoStarted = normStatus === "APPROVED" && isPast24Hours(r.start_date);
    const effectiveStatus = isAutoStarted ? "ACTIVE" : normStatus;
    const isCurrentlyActive = effectiveStatus === "ACTIVE";
    const canStart = !isCurrentlyActive && normStatus === "APPROVED" && isStartReached(r.start_date);
    const isOverdue = isCurrentlyActive && isPastEndDate(r.end_date);

    return (
      <Card
        key={r.id}
        className={`p-5 border-slate-200 transition-all ${
          isOverdue
            ? "ring-2 ring-rose-500/50 bg-rose-50/30 border-rose-300"
            : isCurrentlyActive
            ? "ring-2 ring-emerald-500/30 bg-emerald-50/20"
            : "hover:border-primary/30"
        }`}
        data-testid={`perm-${r.id}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]"
              >
                {t(normType) || t(r.permission_type) || normType}
              </Badge>
              {statusBadge(effectiveStatus, t)}
              {isOverdue && (
                <Badge
                  variant="destructive"
                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10px] gap-1 animate-pulse"
                >
                  <AlertTriangle className="h-3 w-3" />
                  {t("overstay_badge")}
                </Badge>
              )}
              {isStaff && (
                <span className="text-xs text-muted-foreground">
                  · {r.user_name}
                </span>
              )}
            </div>

            <h3 className="text-base font-semibold mt-2 text-slate-900">
              {r.destination || r.overnight_address || t(normType) || "Trip"}
            </h3>

            {/* Contextual Dynamic Details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1">
              {r.transportation_mode && (
                <span className="inline-flex items-center gap-1">
                  <Car className="h-3.5 w-3.5 text-slate-400" />
                  {t(`transport_${r.transportation_mode}`) ||
                    r.transportation_mode}
                </span>
              )}
              {r.overnight_address && (
                <span className="inline-flex items-center gap-1">
                  <Home className="h-3.5 w-3.5 text-slate-400" />
                  {r.overnight_address}
                </span>
              )}
              {r.emergency_contact && (
                <span className="text-slate-500">
                  {t("emergency_contact")}: {r.emergency_contact}
                </span>
              )}
            </div>

            <div className="text-sm text-slate-600 mt-1 tabular-nums font-mono">
              {r.start_date} → {r.end_date}
            </div>

            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
              {r.reason}
            </p>

            {/* Ticket Preview if attached */}
            {r.ticket_attachment_id && (
              <div className="mt-2.5">
                <FileThumb
                  fileId={r.ticket_attachment_id}
                  label={t("ticket_attachment")}
                  testid={`ticket-file-${r.id}`}
                />
              </div>
            )}

            {/* Admin Note */}
            {r.admin_note && (
              <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                  {t("admin_note")}
                </div>
                <div className="text-sm text-slate-700">{r.admin_note}</div>
              </div>
            )}

            {/* Late Return Alert Warning */}
            {isOverdue && (
              <div className="mt-3 rounded-md bg-rose-100/90 border border-rose-300 p-3 flex items-start gap-2.5 text-rose-900">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-semibold">{t("late_return_alert_title")}</div>
                  <div className="mt-0.5 text-rose-800 leading-relaxed">
                    {t("late_return_alert_student_desc").replace(
                      "{date}",
                      r.end_date
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Staff Quick Action Shortcuts & Review */}
            {isStaff && (
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {normStatus === "PENDING" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8 px-2.5 text-xs"
                      disabled={actionLoadingId === r.id}
                      onClick={() => handleQuickStaffApprove(r.id)}
                      data-testid={`quick-approve-${r.id}`}
                    >
                      <Check className="h-3.5 w-3.5" />
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1 h-8 px-2.5 text-xs"
                      disabled={actionLoadingId === r.id}
                      onClick={() => {
                        setRejectTarget(r);
                        setRejectNote("");
                      }}
                      data-testid={`quick-reject-${r.id}`}
                    >
                      <X className="h-3.5 w-3.5" />
                      {t("reject")}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEdit({ ...r })}
                  data-testid={`review-perm-${r.id}`}
                >
                  {t("update")}
                </Button>
              </div>
            )}

            {/* Student Edit Button when status is PENDING */}
            {!isStaff && normStatus === "PENDING" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => openEditDialogForStudent(r)}
                data-testid={`edit-perm-${r.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
                {t("edit")}
              </Button>
            )}

            {/* Student Self Check-in / Check-out / Cancel Buttons */}
            {!isStaff && canStart && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                disabled={actionLoadingId === r.id}
                onClick={() => handleStartJourney(r.id)}
                data-testid={`start-journey-${r.id}`}
              >
                <Navigation className="h-3.5 w-3.5" />
                {t("start_journey")}
              </Button>
            )}

            {!isStaff && normStatus === "APPROVED" && (
              <Button
                variant="outline"
                size="sm"
                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5 h-8 text-xs"
                disabled={actionLoadingId === r.id}
                onClick={() => setCancellingPermission(r)}
                data-testid={`cancel-trip-${r.id}`}
              >
                <XCircle className="h-3.5 w-3.5" />
                {t("cancel_trip")}
              </Button>
            )}

            {!isStaff && isCurrentlyActive && (
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                disabled={actionLoadingId === r.id}
                onClick={() => handleStudentReturnWithGeofence(r.id)}
                data-testid={`return-journey-${r.id}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("i_have_returned")}
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6" data-testid="permissions-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {t("permissions")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length} {t("permissions").toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Admin Permission Settings Button (Admin Only) */}
          {isAdmin && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setDefaultNoteForm(permissionSettings.default_approval_note);
                setGeofenceForm(geofenceSettings);
                setOpenAdminSettings(true);
              }}
              data-testid="permission-settings-btn"
            >
              <Sliders className="h-4 w-4 text-emerald-600" />
              {t("permission_settings")}
            </Button>
          )}

          {/* Student New Permission Button */}
          {!isStaff && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="new-permission-btn">
                  <Plus className="h-4 w-4" />
                  {t("new_permission")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("new_permission")}</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4 pt-2"
                  data-testid="permission-form"
                >
                  {/* Permission Type Selection */}
                  <div className="space-y-1.5">
                    <Label>{t("permission_type")}</Label>
                    <Controller
                      control={control}
                      name="permission_type"
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={(val: any) => field.onChange(val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PERMISSION_TYPES.map((typeKey) => (
                              <SelectItem key={typeKey} value={typeKey}>
                                {t(typeKey)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  {/* CRITICAL FITUR: Iqomah 3-month Alert for VACATION */}
                  {watchedType === "VACATION" && isIqomahExpiringSoon && (
                    <Alert
                      variant="destructive"
                      className="border-amber-400 bg-amber-50 text-amber-950 [&>svg]:text-amber-600"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="font-semibold text-amber-900">
                        {t("warning")}
                      </AlertTitle>
                      <AlertDescription className="text-xs leading-relaxed mt-1 text-amber-800">
                        {t("iqomah_3month_warning")}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Dynamic Fields for OUT_OF_TOWN */}
                  {watchedType === "OUT_OF_TOWN" && (
                    <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                      <div className="space-y-1.5">
                        <Label>
                          {t("destination")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. Riyadh, Jeddah, Medina"
                          {...register("destination")}
                        />
                        {errors.destination && (
                          <p className="text-xs text-red-500">
                            {errors.destination.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("transportation_mode")}</Label>
                        <Controller
                          control={control}
                          name="transportation_mode"
                          render={({ field }) => (
                            <Select
                              value={field.value || "bus"}
                              onValueChange={field.onChange}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="bus">
                                  {t("transport_bus")}
                                </SelectItem>
                                <SelectItem value="train">
                                  {t("transport_train")}
                                </SelectItem>
                                <SelectItem value="flight">
                                  {t("transport_flight")}
                                </SelectItem>
                                <SelectItem value="car">
                                  {t("transport_car")}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields for OVERNIGHT */}
                  {watchedType === "OVERNIGHT" && (
                    <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                      <div className="space-y-1.5">
                        <Label>
                          {t("overnight_address")}{" "}
                          <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          placeholder="e.g. Friend's Apartment, King Fahd Rd"
                          {...register("overnight_address")}
                        />
                        {errors.overnight_address && (
                          <p className="text-xs text-red-500">
                            {errors.overnight_address.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label>
                          {t("emergency_contact")}{" "}
                          <span className="text-muted-foreground font-normal text-xs">
                            ({t("optional")})
                          </span>
                        </Label>
                        <Input
                          placeholder="e.g. +966 5X XXX XXXX (Name / Relation)"
                          {...register("emergency_contact")}
                        />
                      </div>
                    </div>
                  )}

                  {/* Dynamic Fields for VACATION */}
                  {watchedType === "VACATION" && (
                    <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                      <div className="space-y-1.5">
                        <Label>{t("destination")}</Label>
                        <Input
                          placeholder="e.g. Home Country / City"
                          {...register("destination")}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{t("ticket_attachment")}</Label>
                        <FileUpload
                          kind="permission_ticket"
                          value={watchedTicket || null}
                          onChange={(id) => setValue("ticket_attachment_id", id)}
                          label={t("upload_ticket")}
                          accept="image/*,.pdf"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>
                        {t("start_date")}{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input type="date" required {...register("start_date")} />
                      {errors.start_date && (
                        <p className="text-xs text-red-500">
                          {errors.start_date.message}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        {t("end_date")} <span className="text-red-500">*</span>
                      </Label>
                      <Input type="date" required {...register("end_date")} />
                      {errors.end_date && (
                        <p className="text-xs text-red-500">
                          {errors.end_date.message}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Reason */}
                  <div className="space-y-1.5">
                    <Label>
                      {t("reason")} <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      required
                      rows={3}
                      placeholder="Provide details about your leave..."
                      {...register("reason")}
                    />
                    {errors.reason && (
                      <p className="text-xs text-red-500">
                        {errors.reason.message}
                      </p>
                    )}
                  </div>

                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpenNew(false)}
                    >
                      {t("cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      data-testid="permission-submit"
                    >
                      {saving ? "Submitting…" : t("submit")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Staff & Admin Search and Filter Controls */}
      {isStaff && (
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search_permissions_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-9 bg-white"
              data-testid="search-permissions-input"
            />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[145px] bg-white text-xs">
                <SelectValue placeholder={t("filter_by_status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("all_statuses")}</SelectItem>
                {PERMISSION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[145px] bg-white text-xs">
                <SelectValue placeholder={t("filter_by_type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t("all_types")}</SelectItem>
                {PERMISSION_TYPES.map((typeKey) => (
                  <SelectItem key={typeKey} value={typeKey}>
                    {t(typeKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Permissions List: Staff/Admin filtered view */}
      {isStaff && (
        <div className="grid gap-4">
          {filteredStaffRows.length === 0 ? (
            <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {t("no_data")}
            </Card>
          ) : (
            filteredStaffRows.map((r) => renderPermissionCard(r))
          )}
        </div>
      )}

      {/* Permissions List: Student Grouped Tabs (Active vs History) */}
      {!isStaff && (
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full sm:w-auto sm:inline-grid grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <Clock className="h-4 w-4" />
              {t("active_in_progress")}
              {activeStudentRows.length > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] bg-primary/10 text-primary"
                >
                  {activeStudentRows.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <CalendarCheck className="h-4 w-4" />
              {t("permission_history")}
              {historyStudentRows.length > 0 && (
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] bg-slate-100 text-slate-700"
                >
                  {historyStudentRows.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-4">
            {activeStudentRows.length === 0 ? (
              <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t("no_active_permissions")}
              </Card>
            ) : (
              activeStudentRows.map((r) => renderPermissionCard(r))
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-4">
            {historyStudentRows.length === 0 ? (
              <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
                <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                {t("no_history_permissions")}
              </Card>
            ) : (
              historyStudentRows.map((r) => renderPermissionCard(r))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Shortcut Reject Popup (Note is Optional) */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => !o && setRejectTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <X className="h-5 w-5" />
              <DialogTitle className="text-red-900">
                {t("reject_permission_title")}
              </DialogTitle>
            </div>
            {rejectTarget && (
              <p className="text-xs text-muted-foreground">
                {rejectTarget.user_name} ·{" "}
                {rejectTarget.destination ||
                  rejectTarget.overnight_address ||
                  t(rejectTarget.permission_type)}{" "}
                ({rejectTarget.start_date} → {rejectTarget.end_date})
              </p>
            )}
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {t("rejection_reason_optional")}
              </Label>
              <Textarea
                rows={3}
                placeholder={t("rejection_placeholder")}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                {t("rejection_optional_hint")}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectTarget(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={savingReject}
              onClick={handleConfirmReject}
              data-testid="confirm-reject-btn"
            >
              {savingReject ? "Rejecting..." : t("confirm_reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Staff Full Review & Edit Dialog */}
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
                  value={(edit.status || "").toUpperCase()}
                  onValueChange={(v) =>
                    edit && setEdit({ ...edit, status: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                  disabled={saving}
                  data-testid="perm-update-submit"
                >
                  {saving ? "Updating…" : t("update")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Student Edit PENDING Permission Dialog */}
      <Dialog
        open={!!studentEditTarget}
        onOpenChange={(o) => !o && setStudentEditTarget(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("edit_permission")}</DialogTitle>
          </DialogHeader>
          {studentEditTarget && (
            <form
              onSubmit={handleSubmitEdit(onSubmitStudentEdit)}
              className="space-y-4 pt-2"
              data-testid="student-edit-form"
            >
              {/* Permission Type Selection */}
              <div className="space-y-1.5">
                <Label>{t("permission_type")}</Label>
                <Controller
                  control={controlEdit}
                  name="permission_type"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(val: any) => field.onChange(val)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PERMISSION_TYPES.map((typeKey) => (
                          <SelectItem key={typeKey} value={typeKey}>
                            {t(typeKey)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              {/* Dynamic Fields for OUT_OF_TOWN */}
              {watchedEditType === "OUT_OF_TOWN" && (
                <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                  <div className="space-y-1.5">
                    <Label>
                      {t("destination")}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Riyadh, Jeddah, Medina"
                      {...registerEdit("destination")}
                    />
                    {errorsEdit.destination && (
                      <p className="text-xs text-red-500">
                        {errorsEdit.destination.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("transportation_mode")}</Label>
                    <Controller
                      control={controlEdit}
                      name="transportation_mode"
                      render={({ field }) => (
                        <Select
                          value={field.value || "bus"}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bus">
                              {t("transport_bus")}
                            </SelectItem>
                            <SelectItem value="train">
                              {t("transport_train")}
                            </SelectItem>
                            <SelectItem value="flight">
                              {t("transport_flight")}
                            </SelectItem>
                            <SelectItem value="car">
                              {t("transport_car")}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Fields for OVERNIGHT */}
              {watchedEditType === "OVERNIGHT" && (
                <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                  <div className="space-y-1.5">
                    <Label>
                      {t("overnight_address")}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="e.g. Friend's Apartment, King Fahd Rd"
                      {...registerEdit("overnight_address")}
                    />
                    {errorsEdit.overnight_address && (
                      <p className="text-xs text-red-500">
                        {errorsEdit.overnight_address.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      {t("emergency_contact")}{" "}
                      <span className="text-muted-foreground font-normal text-xs">
                        ({t("optional")})
                      </span>
                    </Label>
                    <Input
                      placeholder="e.g. +966 5X XXX XXXX (Name / Relation)"
                      {...registerEdit("emergency_contact")}
                    />
                  </div>
                </div>
              )}

              {/* Dynamic Fields for VACATION */}
              {watchedEditType === "VACATION" && (
                <div className="space-y-4 rounded-lg bg-slate-50/70 p-3 border border-slate-200">
                  <div className="space-y-1.5">
                    <Label>{t("destination")}</Label>
                    <Input
                      placeholder="e.g. Home Country / City"
                      {...registerEdit("destination")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("ticket_attachment")}</Label>
                    <FileUpload
                      kind="permission_ticket"
                      value={watchedEditTicket || null}
                      onChange={(id) => setValueEdit("ticket_attachment_id", id)}
                      label={t("upload_ticket")}
                      accept="image/*,.pdf"
                    />
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    {t("start_date")} <span className="text-red-500">*</span>
                  </Label>
                  <Input type="date" required {...registerEdit("start_date")} />
                  {errorsEdit.start_date && (
                    <p className="text-xs text-red-500">
                      {errorsEdit.start_date.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>
                    {t("end_date")} <span className="text-red-500">*</span>
                  </Label>
                  <Input type="date" required {...registerEdit("end_date")} />
                  {errorsEdit.end_date && (
                    <p className="text-xs text-red-500">
                      {errorsEdit.end_date.message}
                    </p>
                  )}
                </div>
              </div>

              {/* Reason */}
              <div className="space-y-1.5">
                <Label>
                  {t("reason")} <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  required
                  rows={3}
                  {...registerEdit("reason")}
                />
                {errorsEdit.reason && (
                  <p className="text-xs text-red-500">
                    {errorsEdit.reason.message}
                  </p>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStudentEditTarget(null)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : t("save_changes")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin Permission Settings Dialog (Tabs: Note & Geofence) */}
      <Dialog open={openAdminSettings} onOpenChange={setOpenAdminSettings}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <Sliders className="h-5 w-5" />
              <DialogTitle>{t("permission_settings")}</DialogTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("permission_settings_desc")}
            </p>
          </DialogHeader>

          <form onSubmit={handleSaveAdminSettings} className="space-y-4 pt-1">
            <Tabs defaultValue="note" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="note" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  {t("tab_approval_note")}
                </TabsTrigger>
                <TabsTrigger value="geofence" className="gap-1.5 text-xs">
                  <MapPin className="h-3.5 w-3.5" />
                  {t("tab_geofence")}
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Default Approval Note */}
              <TabsContent value="note" className="space-y-3.5 pt-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-slate-900">
                    {t("default_approval_note")}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("default_approval_note_desc")}
                  </p>
                  <Textarea
                    rows={4}
                    placeholder={t("default_approval_note_placeholder")}
                    value={defaultNoteForm}
                    onChange={(e) => setDefaultNoteForm(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setDefaultNoteForm(DEFAULT_NOTES.en)}
                  >
                    {t("template_en")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 font-arabic"
                    onClick={() => setDefaultNoteForm(DEFAULT_NOTES.ar)}
                  >
                    {t("template_ar")}
                  </Button>
                </div>
              </TabsContent>

              {/* Tab 2: Geofencing Settings */}
              <TabsContent value="geofence" className="space-y-4 pt-3">
                <div className="flex items-center justify-between rounded-lg border p-3 bg-slate-50">
                  <div>
                    <Label className="text-sm font-medium">
                      {t("geofence_enabled")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("geofence_switch_desc")}
                    </p>
                  </div>
                  <Switch
                    checked={geofenceForm.enabled}
                    onCheckedChange={(v) =>
                      setGeofenceForm({ ...geofenceForm, enabled: v })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("dorm_location_name")}</Label>
                  <Input
                    value={geofenceForm.name}
                    onChange={(e) =>
                      setGeofenceForm({ ...geofenceForm, name: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("latitude")}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={geofenceForm.latitude}
                      onChange={(e) =>
                        setGeofenceForm({
                          ...geofenceForm,
                          latitude: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("longitude")}</Label>
                    <Input
                      type="number"
                      step="any"
                      value={geofenceForm.longitude}
                      onChange={(e) =>
                        setGeofenceForm({
                          ...geofenceForm,
                          longitude: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t("radius_meters")}</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {geofenceForm.radius_meters} m
                    </span>
                  </div>
                  <Input
                    type="number"
                    min="50"
                    max="5000"
                    value={geofenceForm.radius_meters}
                    onChange={(e) =>
                      setGeofenceForm({
                        ...geofenceForm,
                        radius_meters: parseInt(e.target.value) || 500,
                      })
                    }
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  className="w-full gap-2 text-xs"
                  onClick={handleCaptureAdminLocation}
                >
                  <Navigation className="h-3.5 w-3.5" />
                  {t("use_current_location")}
                </Button>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenAdminSettings(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving..." : t("save_changes")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Outside Geofence Alert Modal */}
      <Dialog
        open={!!outsideGeofenceInfo}
        onOpenChange={(o) => !o && setOutsideGeofenceInfo(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <MapPinOff className="h-5 w-5" />
              <DialogTitle className="text-rose-900">
                {t("outside_geofence_title")}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm text-slate-700">
            <p className="leading-relaxed">
              {t("outside_geofence_alert_msg")}
            </p>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs space-y-1.5">
              <div>
                <strong>{t("dorm_location_name")}:</strong>{" "}
                {outsideGeofenceInfo?.dormName}
              </div>
              <div>
                <strong>{t("current_distance")}</strong>{" "}
                <span className="text-rose-700 font-bold tabular-nums">
                  {outsideGeofenceInfo?.distance} m
                </span>
              </div>
              <div>
                <strong>{t("max_allowed_radius")}</strong>{" "}
                <span className="text-emerald-700 font-bold tabular-nums">
                  {outsideGeofenceInfo?.maxRadius} m
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("outside_geofence_footer_note")}
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOutsideGeofenceInfo(null)}
            >
              {t("close")}
            </Button>
            {outsideGeofenceInfo && (
              <Button
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => {
                  const id = outsideGeofenceInfo.permissionId;
                  setOutsideGeofenceInfo(null);
                  handleStudentReturnWithGeofence(id);
                }}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t("retry_location")}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for Cancelling Approved Journey */}
      <Dialog
        open={!!cancellingPermission}
        onOpenChange={(o) => !o && setCancellingPermission(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-rose-900">
                {t("cancel_trip_confirm_title")}
              </DialogTitle>
            </div>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-600 leading-relaxed">
            {t("cancel_trip_confirm_desc")}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancellingPermission(null)}
              disabled={cancellingLoading}
            >
              {t("keep_permission")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancelTrip}
              disabled={cancellingLoading}
              className="bg-rose-600 hover:bg-rose-700 gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              {t("confirm_cancel_trip")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
