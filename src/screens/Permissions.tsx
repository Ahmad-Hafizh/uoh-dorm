"use client";
import axios from "axios";
import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Plus, CalendarCheck } from "lucide-react";
import { toast } from "sonner";

const TYPES = ["outing", "overnight", "vacation"];
const STATUSES = ["pending", "approved", "rejected"];

interface Permission { id: string; status: string; user_name: string; permission_type: string; destination: string; start_date: string; end_date: string; reason: string; admin_note: string }

function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    approved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  };
  return <Badge className={map[status]}>{t(status)}</Badge>;
}

export default function Permissions() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { markRead, refresh: refreshNotifications } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const [rows, setRows] = useState<Permission[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ permission_type: "outing", destination: "", start_date: "", end_date: "", reason: "" });
  const [edit, setEdit] = useState<Permission | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setRows((await api.get("/permissions")).data);
      refreshNotifications();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => {
    load();
    if (user && user.role === "student") markRead("permissions");
    // eslint-disable-next-line
  }, [user]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/permissions", form);
      toast.success("Submitted");
      setOpenNew(false);
      setForm({ permission_type: "outing", destination: "", start_date: "", end_date: "", reason: "" });
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/permissions/${edit.id}`, { status: edit.status, admin_note: edit.admin_note });
      toast.success("Updated"); setEdit(null); load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="permissions-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("permissions")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("permissions").toLowerCase()}</p>
        </div>
        {!isStaff && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="new-permission-btn"><Plus className="h-4 w-4" />{t("new_permission")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("new_permission")}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4 pt-2" data-testid="permission-form">
                <div className="space-y-1.5">
                  <Label>{t("permission_type")}</Label>
                  <Select value={form.permission_type} onValueChange={(v) => setForm({ ...form, permission_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((c) => <SelectItem key={c} value={c}>{t(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("destination")}</Label>
                  <Input required value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>{t("start_date")}</Label>
                    <Input type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("end_date")}</Label>
                    <Input type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("reason")}</Label>
                  <Textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>{t("cancel")}</Button>
                  <Button type="submit" disabled={saving} data-testid="permission-submit">{t("submit")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {rows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />{t("no_data")}
          </Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="p-5 border-slate-200 hover:border-primary/30 transition-colors" data-testid={`perm-${r.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]">{t(r.permission_type)}</Badge>
                  {statusBadge(r.status, t)}
                  {isStaff && <span className="text-xs text-muted-foreground">· {r.user_name}</span>}
                </div>
                <h3 className="text-base font-semibold mt-2 text-slate-900">{r.destination}</h3>
                <div className="text-sm text-slate-600 mt-1 tabular-nums">
                  {r.start_date} → {r.end_date}
                </div>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{r.reason}</p>
                {r.admin_note && (
                  <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{t("admin_note")}</div>
                    <div className="text-sm text-slate-700">{r.admin_note}</div>
                  </div>
                )}
              </div>
              {isStaff && (
                <Button variant="outline" size="sm" onClick={() => setEdit({ ...r })} data-testid={`review-perm-${r.id}`}>
                  {t("update")}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("update")}</DialogTitle></DialogHeader>
          {edit && (
            <form onSubmit={submitEdit} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label>{t("status")}</Label>
                <Select value={edit.status} onValueChange={(v) => edit && setEdit({ ...edit, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("admin_note")}</Label>
                <Textarea rows={3} value={edit.admin_note || ""} onChange={(e) => edit && setEdit({ ...edit, admin_note: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving} data-testid="perm-update-submit">{t("update")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
