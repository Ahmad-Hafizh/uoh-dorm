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
import { Plus, FileText, Paperclip, Eye } from "lucide-react";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import { FileViewButton } from "@/components/FilePreview";

const TYPES = ["iqomah_renewal", "return_ticket", "letter_of_enrollment", "exit_reentry_visa", "other"];
const STATUSES = ["pending", "in_progress", "approved", "rejected", "completed"];

interface DocumentRequest { id: string; status: string; user_name: string; created_at: string; request_type: string; notes: string; attachment_file_ids: string[]; admin_note: string }
function statusBadge(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    in_progress: "bg-sky-100 text-sky-800 hover:bg-sky-100",
    approved: "bg-primary/10 text-primary hover:bg-primary/15",
    rejected: "bg-red-100 text-red-800 hover:bg-red-100",
    completed: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  };
  return <Badge className={map[status]}>{t(status)}</Badge>;
}

export default function Documents() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const [rows, setRows] = useState<DocumentRequest[]>([]);
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState<{ request_type: string; notes: string; attachment_file_ids: string[] }>({ request_type: "iqomah_renewal", notes: "", attachment_file_ids: [] });
  const [edit, setEdit] = useState<DocumentRequest | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { setRows((await api.get("/documents")).data); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/documents", form);
      toast.success("Submitted");
      setOpenNew(false); setForm({ request_type: "iqomah_renewal", notes: "", attachment_file_ids: [] });
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  const submitEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!edit) return;
    setSaving(true);
    try {
      await api.patch(`/documents/${edit.id}`, { status: edit.status, admin_note: edit.admin_note });
      toast.success("Updated");
      setEdit(null); load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6" data-testid="documents-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("documents")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("documents").toLowerCase()}</p>
        </div>
        {!isStaff && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="new-document-btn"><Plus className="h-4 w-4" />{t("new_document_request")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("new_document_request")}</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-4 pt-2" data-testid="document-form">
                <div className="space-y-1.5">
                  <Label>{t("request_type")}</Label>
                  <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((c) => <SelectItem key={c} value={c}>{t(c)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("notes")}</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />{t("attachments")}
                  </Label>
                  <div className="space-y-2">
                    {form.attachment_file_ids.map((fid, idx) => (
                      <FileUpload
                        key={fid + idx} label="" kind={`attachment-${idx}`} value={fid}
                        onChange={(newId: string | null) => {
                          const arr = [...form.attachment_file_ids];
                          if (newId) arr[idx] = newId;
                          else arr.splice(idx, 1);
                          setForm({ ...form, attachment_file_ids: arr });
                        }}
                      />
                    ))}
                    <FileUpload
                      key={`new-${form.attachment_file_ids.length}`}
                      kind={`attachment-new-${form.attachment_file_ids.length}`}
                      value={null}
                      onChange={(id: string | null) => id && setForm({ ...form, attachment_file_ids: [...form.attachment_file_ids, id] })}
                      label={t("add_attachment")}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>{t("cancel")}</Button>
                  <Button type="submit" disabled={saving} data-testid="document-submit">{t("submit")}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4">
        {rows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />{t("no_data")}
          </Card>
        )}
        {rows.map((r) => (
          <Card key={r.id} className="p-5 border-slate-200 hover:border-primary/30 transition-colors" data-testid={`doc-row-${r.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px]">{t(r.request_type)}</Badge>
                  {statusBadge(r.status, t)}
                  {isStaff && <span className="text-xs text-muted-foreground">· {r.user_name}</span>}
                </div>
                {r.notes && <p className="text-sm text-slate-600 mt-2 leading-relaxed">{r.notes}</p>}
                {r.attachment_file_ids && r.attachment_file_ids.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.attachment_file_ids.map((fid) => (
                      <AttachmentPill key={fid} fileId={fid} />
                    ))}
                  </div>
                )}
                {r.admin_note && (
                  <div className="mt-3 rounded-md bg-slate-50 border border-slate-200 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">{t("admin_note")}</div>
                    <div className="text-sm text-slate-700">{r.admin_note}</div>
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              {isStaff && (
                <Button variant="outline" size="sm" onClick={() => setEdit({ ...r })} data-testid={`update-doc-${r.id}`}>
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
                <Button type="submit" disabled={saving} data-testid="doc-update-submit">{t("update")}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentPill({ fileId }: { fileId: string }) {
  const [meta, setMeta] = useState<{ original_filename: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.get(`/files/${fileId}`).then((r) => { if (!cancelled) setMeta(r.data); }).catch(() => {});
    return () => { cancelled = true; };
  }, [fileId]);
  const name = meta?.original_filename || "file";
  return (
    <FileViewButton
      fileId={fileId}
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs hover:border-primary/40 hover:bg-primary/5 transition-colors"
      testid={`attachment-${fileId}`}
    >
      <Paperclip className="h-3 w-3 text-primary" />
      <span className="truncate max-w-[180px]">{name}</span>
      <Eye className="h-3 w-3 text-muted-foreground" />
    </FileViewButton>
  );
}
