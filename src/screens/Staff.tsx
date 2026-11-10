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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface StaffMember { id: string; name: string; email: string; role: string; created_at: string }
const EMPTY = { email: "", password: "", name: "", role: "staff" };

export default function Staff() {
  const { t } = useI18n();
  const { user: me } = useAuth();
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setRows((await api.get("/staff")).data); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };
  const openEdit = (r: StaffMember) => {
    setEditing(r);
    setForm({ email: r.email, password: "", name: r.name, role: r.role });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        const payload: { name: string; role: string; password?: string } = { name: form.name, role: form.role };
        if (form.password) payload.password = form.password;
        await api.patch(`/staff/${editing.id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/staff", form);
        toast.success("Created");
      }
      setOpen(false);
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this account?")) return;
    try { await api.delete(`/staff/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  const roleBadge = (role: string) => (
    <Badge className={
      role === "admin"
        ? "bg-primary text-primary-foreground hover:bg-primary uppercase text-[10px]"
        : "bg-sky-100 text-sky-800 hover:bg-sky-100 uppercase text-[10px]"
    }>{role}</Badge>
  );

  return (
    <div className="space-y-6" data-testid="staff-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("staff_management")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("staff_management").toLowerCase()}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-2" data-testid="add-staff-btn">
              <Plus className="h-4 w-4" /> {t("add_staff")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? t("edit") : t("add_staff")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={submit} className="space-y-4 pt-2" data-testid="staff-form">
              {!editing && (
                <div className="space-y-1.5">
                  <Label>{t("email")}</Label>
                  <Input type="email" required value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>{t("name")}</Label>
                <Input required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("role")}</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">{t("staff")}</SelectItem>
                    <SelectItem value="admin">{t("admin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {editing ? t("change_password") : t("password")}
                </Label>
                <Input
                  type="password"
                  required={!editing}
                  placeholder={editing ? t("leave_blank_keep") : ""}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
                <Button type="submit" disabled={saving} data-testid="staff-submit">
                  {saving ? "…" : t("save")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-start px-4 py-3 font-medium">{t("name")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("email")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("role")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("created_at")}</th>
                <th className="text-start px-4 py-3 font-medium">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">{t("no_data")}</td></tr>
              )}
              {rows.map((r) => {
                const isSelf = r.id === (me || null)?.id;
                return (
                  <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60" data-testid={`staff-row-${r.id}`}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <div>{r.name}</div>
                          {isSelf && <div className="text-[10px] text-primary uppercase tracking-wider">— {t("self_row_hint")}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-3">{roleBadge(r.role)}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} data-testid={`edit-staff-${r.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!isSelf && (
                          <Button size="sm" variant="ghost" className="text-destructive"
                            onClick={() => del(r.id)} data-testid={`delete-staff-${r.id}`}>
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
    </div>
  );
}
