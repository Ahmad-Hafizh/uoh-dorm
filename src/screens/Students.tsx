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
import { Plus, Search, Trash2, Pencil, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import FileUpload from "@/components/FileUpload";
import { FileThumb } from "@/components/FilePreview";

interface Student { id: string; full_name: string; nationality: string; passport_number: string; passport_expiry: string; iqomah_number: string; iqomah_expiry: string; phone: string; building: string; room_number: string; program: string; academic_year: string; passport_file_id: string | null; iqomah_file_id: string | null }
type StudentForm = Omit<Student, "id"> & { email: string; password: string };
const EMPTY: StudentForm = {
  email: "", password: "", full_name: "", nationality: "",
  passport_number: "", passport_expiry: "", iqomah_number: "", iqomah_expiry: "",
  phone: "", building: "", room_number: "", program: "", academic_year: "2025/2026",
  passport_file_id: null, iqomah_file_id: null,
};

export default function Students() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StudentForm>(EMPTY);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/students");
      setRows(data);
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (r: Student) => {
    setEditing(r);
    setForm({ ...EMPTY, ...r, email: "", password: "" });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const { password, email, ...updates } = form;
        await api.patch(`/students/${editing.id}`, updates);
        toast.success("Updated");
      } else {
        await api.post("/students", form);
        toast.success("Student created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete student?")) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  const searchLower = search.toLowerCase();
  const bySearch = rows.filter((r) =>
    (r.full_name + r.nationality + r.room_number + r.iqomah_number).toLowerCase().includes(searchLower)
  );
  const counts = {
    all: bySearch.length,
    missing_passport: bySearch.filter((r) => !r.passport_file_id).length,
    missing_iqomah: bySearch.filter((r) => !r.iqomah_file_id).length,
    missing_any: bySearch.filter((r) => !r.passport_file_id || !r.iqomah_file_id).length,
  };
  const filtered = bySearch.filter((r) => {
    if (tab === "missing_passport") return !r.passport_file_id;
    if (tab === "missing_iqomah") return !r.iqomah_file_id;
    if (tab === "missing_any") return !r.passport_file_id || !r.iqomah_file_id;
    return true;
  });
  const canDelete = user && user.role === "admin";

  return (
    <div className="space-y-6" data-testid="students-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("students")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("students").toLowerCase()}</p>
        </div>
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
                  <Field label={t("email")} required value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
                  <Field label={t("password")} required value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
                </>
              )}
              <Field label={t("full_name")} required value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
              <div className="space-y-1.5">
                <Label className="text-xs">{t("nationality")}</Label>
                <Select value={form.nationality || ""} onValueChange={(v) => setForm({ ...form, nationality: v })}>
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
              <Field label={t("passport")} required value={form.passport_number} onChange={(v) => setForm({ ...form, passport_number: v })} />
              <Field label={t("passport_expiry")} type="date" required value={form.passport_expiry} onChange={(v) => setForm({ ...form, passport_expiry: v })} />
              <Field label={t("iqomah_number")} required value={form.iqomah_number} onChange={(v) => setForm({ ...form, iqomah_number: v })} />
              <Field label={t("iqomah_expiry")} type="date" required value={form.iqomah_expiry} onChange={(v) => setForm({ ...form, iqomah_expiry: v })} />
              <Field label={t("phone")} required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label={t("building")} required value={form.building} onChange={(v) => setForm({ ...form, building: v })} />
              <Field label={t("room_number")} required value={form.room_number} onChange={(v) => setForm({ ...form, room_number: v })} />
              <Field label={t("program")} required value={form.program} onChange={(v) => setForm({ ...form, program: v })} />
              <Field label={t("academic_year")} required value={form.academic_year} onChange={(v) => setForm({ ...form, academic_year: v })} />
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
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving} data-testid="student-submit">{saving ? "…" : t("save")}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={setTab} data-testid="students-filter">
          <TabsList className="bg-slate-100 h-auto p-1 gap-1 flex-wrap">
            <TabsTrigger value="all" className="gap-1.5" data-testid="tab-all">
              {t("all")}
              <span className="text-[10px] rounded-full bg-white px-1.5 py-0.5 tabular-nums font-semibold text-slate-600">{counts.all}</span>
            </TabsTrigger>
            <TabsTrigger value="missing_passport" className="gap-1.5" data-testid="tab-missing-passport">
              {t("missing_passport")}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 tabular-nums font-semibold ${counts.missing_passport ? "bg-amber-100 text-amber-800" : "bg-white text-slate-600"}`}>{counts.missing_passport}</span>
            </TabsTrigger>
            <TabsTrigger value="missing_iqomah" className="gap-1.5" data-testid="tab-missing-iqomah">
              {t("missing_iqomah")}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 tabular-nums font-semibold ${counts.missing_iqomah ? "bg-amber-100 text-amber-800" : "bg-white text-slate-600"}`}>{counts.missing_iqomah}</span>
            </TabsTrigger>
            <TabsTrigger value="missing_any" className="gap-1.5" data-testid="tab-missing-any">
              {t("missing_docs")}
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 tabular-nums font-semibold ${counts.missing_any ? "bg-red-100 text-red-800" : "bg-white text-slate-600"}`}>{counts.missing_any}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("search")} value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" data-testid="student-search" />
        </div>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-start px-4 py-3 font-medium">{t("full_name")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("nationality")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("building")} · {t("room")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("iqomah_number")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("iqomah_expiry")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("attachments")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{t("no_data")}</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`student-row-${r.id}`}>
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3">{getCountryLabel(r.nationality, lang)}</td>
                  <td className="px-4 py-3">{r.building} · {r.room_number}</td>
                  <td className="px-4 py-3 tabular-nums">{r.iqomah_number}</td>
                  <td className="px-4 py-3 tabular-nums">
                    <Badge variant="secondary" className="bg-slate-100 text-slate-700 hover:bg-slate-100">{r.iqomah_expiry}</Badge>
                  </td>
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
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`edit-${r.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(r.id)} data-testid={`delete-${r.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange(value: string): void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} required={required} value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
