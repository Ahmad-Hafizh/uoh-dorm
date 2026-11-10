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
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Plus, Megaphone, Trash2, Pin } from "lucide-react";
import { toast } from "sonner";

interface Announcement { id: string; title_en: string; title_ar: string; body_en: string; body_ar: string; pinned: boolean; created_at: string; author_name: string }
const EMPTY = { title_en: "", title_ar: "", body_en: "", body_ar: "", pinned: false };

export default function Announcements() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { markRead } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setRows((await api.get("/announcements")).data); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => {
    load();
    if (user && user.role === "student") markRead("announcements");
    // eslint-disable-next-line
  }, [user]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/announcements", form);
      toast.success("Published");
      setOpen(false); setForm(EMPTY); load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete announcement?")) return;
    try { await api.delete(`/announcements/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  return (
    <div className="space-y-6" data-testid="announcements-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("announcements")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("announcements").toLowerCase()}</p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="new-announcement-btn"><Plus className="h-4 w-4" />{t("new_announcement")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{t("new_announcement")}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4 pt-2" data-testid="announcement-form">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("title_en")}</Label>
                    <Input required value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("title_ar")}</Label>
                    <Input required dir="rtl" value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("body_en")}</Label>
                  <Textarea required rows={4} value={form.body_en} onChange={(e) => setForm({ ...form, body_en: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("body_ar")}</Label>
                  <Textarea required rows={4} dir="rtl" value={form.body_ar} onChange={(e) => setForm({ ...form, body_ar: e.target.value })} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="pin" checked={form.pinned} onCheckedChange={(v) => setForm({ ...form, pinned: v })} />
                  <Label htmlFor="pin" className="cursor-pointer">{t("pin")}</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                  <Button type="submit" disabled={saving} data-testid="announcement-submit">{t("submit")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {rows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />{t("no_data")}
          </Card>
        )}
        {rows.map((a) => {
          const title = lang === "ar" ? a.title_ar : a.title_en;
          const body = lang === "ar" ? a.body_ar : a.body_en;
          return (
            <Card key={a.id} className={`p-5 border-slate-200 hover:border-primary/30 transition-colors ${a.pinned ? "ring-1 ring-primary/20 bg-primary/[0.02]" : ""}`} data-testid={`ann-${a.id}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.pinned && <Badge className="bg-primary/10 text-primary hover:bg-primary/15 gap-1"><Pin className="h-3 w-3" />{t("pinned")}</Badge>}
                    <span className="text-[11px] text-muted-foreground tabular-nums">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                  <h3 className="text-lg font-semibold mt-2 text-slate-900">{title}</h3>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line">{body}</p>
                  <div className="text-[11px] text-muted-foreground mt-2">— {a.author_name}</div>
                </div>
                {isStaff && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(a.id)} data-testid={`delete-ann-${a.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
