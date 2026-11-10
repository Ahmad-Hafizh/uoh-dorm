"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
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
import { Plus, MessageSquareWarning } from "lucide-react";
import { toast } from "sonner";

const CATS = ["facility", "academic", "roommate", "other"];
const STATUSES = ["pending", "in_progress", "resolved", "rejected"];

interface Complaint { id: string; status: string; user_name: string; created_at: string; category: string; title: string; description: string; admin_response: string }

function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    in_progress: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    resolved: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
    rejected: "bg-red-100 text-red-800 hover:bg-red-100",
  };
  return <Badge className={map[status]}>{t(status)}</Badge>;
}

export default function Complaints() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const [rows, setRows] = useState<Complaint[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ category: "facility", title: "", description: "" });
  const [edit, setEdit] = useState<Complaint | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/complaints");
      setRows(data);
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/complaints", form);
      toast.success("Submitted");
      setOpenNew(false);
      setForm({ category: "facility", title: "", description: "" });
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/complaints/${edit.id}`, { status: edit.status, admin_response: edit.admin_response });
      toast.success("Updated");
      setEdit(null);
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="complaints-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("complaints")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("complaints").toLowerCase()}</p>
        </div>
        {!isStaff && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="new-complaint-btn"><Plus className="h-4 w-4" />{t("new_complaint")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("new_complaint")}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4 pt-2" data-testid="complaint-form">
                <div className="space-y-1.5">
                  <Label>{t("category")}</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATS.map((c) => <SelectItem key={c} value={c}>{t(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("title")}</Label>
                  <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("description")}</Label>
                  <Textarea required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>{t("cancel")}</Button>
                  <Button type="submit" disabled={saving} data-testid="complaint-submit">{t("submit")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {rows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <MessageSquareWarning className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("no_data")}
          </Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="p-5 border-slate-200 hover:border-primary/30 transition-colors" data-testid={`complaint-row-${r.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]">{t(r.category)}</Badge>
                  {statusBadge(r.status, t)}
                  {isStaff && <span className="text-xs text-muted-foreground">· {r.user_name}</span>}
                </div>
                <h3 className="text-lg font-semibold mt-2 text-slate-900">{r.title}</h3>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{r.description}</p>
                {r.admin_response && (
                  <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{t("admin_response")}</div>
                    <div className="text-sm text-slate-700">{r.admin_response}</div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              {isStaff && (
                <Button variant="outline" size="sm" onClick={() => setEdit({ ...r })} data-testid={`respond-${r.id}`}>
                  {t("respond")}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("respond")}</DialogTitle></DialogHeader>
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
                <Label>{t("admin_response")}</Label>
                <Textarea rows={4} value={edit.admin_response || ""} onChange={(e) => edit && setEdit({ ...edit, admin_response: e.target.value })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEdit(null)}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving} data-testid="complaint-update">{t("update")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
