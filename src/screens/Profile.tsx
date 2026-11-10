"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { UserCircle2 } from "lucide-react";
import FileUpload from "@/components/FileUpload";
import { toast } from "sonner";
import { getCountryLabel } from "@/constants/countries";

interface ProfileData { full_name: string; nationality: string; phone: string; program: string; academic_year: string; building: string; room_number: string; passport_number: string; passport_expiry: string; iqomah_number: string; iqomah_expiry: string; passport_file_id: string | null; iqomah_file_id: string | null }

export default function Profile() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const currentUser = user || null;
  const isStudent = currentUser?.role === "student";

  const load = () => {
    if (isStudent) {
      api.get("/students/me").then((r) => setProfile(r.data)).catch(() => {});
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [user]);

  const patchFile = async (field: "passport_file_id" | "iqomah_file_id", fileId: string | null) => {
    try {
      const { data } = await api.patch("/students/me", { [field]: fileId });
      setProfile(data);
      toast.success(t("save") + " ✓");
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  return (
    <div className="space-y-6 max-w-3xl" data-testid="profile-page">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("profile")}</h1>
      <Card className="p-6 border-slate-200">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary">
            <UserCircle2 className="h-9 w-9" />
          </div>
          <div>
            <div className="text-lg font-semibold">{currentUser?.name}</div>
            <div className="text-sm text-muted-foreground">{currentUser?.email}</div>
            <Badge className="mt-1.5 bg-primary/10 text-primary hover:bg-primary/15 uppercase text-[10px]">{currentUser?.role}</Badge>
          </div>
        </div>
      </Card>

      {profile && (
        <>
          <Card className="p-6 border-slate-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">{t("student")} {t("profile")}</div>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <Row label={t("full_name")} value={profile.full_name} />
              <Row label={t("nationality")} value={getCountryLabel(profile.nationality, lang)} />
              <Row label={t("phone")} value={profile.phone} />
              <Row label={t("program")} value={profile.program} />
              <Row label={t("academic_year")} value={profile.academic_year} />
              <Row label={t("building")} value={profile.building} />
              <Row label={t("room")} value={profile.room_number} />
              <Row label={t("passport")} value={profile.passport_number} />
              <Row label={t("passport_expiry")} value={profile.passport_expiry} />
              <Row label={t("iqomah_number")} value={profile.iqomah_number} />
              <Row label={t("iqomah_expiry")} value={profile.iqomah_expiry} />
            </div>
          </Card>

          <Card className="p-6 border-slate-200" data-testid="my-documents-section">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">{t("my_documents")}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("passport_file")}</Label>
                <FileUpload
                  kind="passport"
                  value={profile.passport_file_id || null}
                  onChange={(id: string | null) => patchFile("passport_file_id", id)}
                  label={t("upload_passport_now")}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("iqomah_file")}</Label>
                <FileUpload
                  kind="iqomah"
                  value={profile.iqomah_file_id || null}
                  onChange={(id: string | null) => patchFile("iqomah_file_id", id)}
                  label={t("upload_iqomah_now")}
                />
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-slate-800 text-end">{value || "—"}</span>
    </div>
  );
}
