"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { api, API, formatApiError } from "@/lib/api";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Plus, ClipboardList, Trash2, Pencil, MessageSquare, Check, X, GripVertical, FileEdit, Download
} from "lucide-react";
import { toast } from "sonner";

interface Question { id: string; label: string; type: string; required: boolean; options?: string[] | null }
interface FormRecord { id: string; title: string; description: string; is_active: boolean; questions: Question[]; response_count: number; my_submitted?: boolean }
type Answer = string | string[];
interface FormResponse { id: string; user_name: string; submitted_at: string; updated_at: string | null; answers: Record<string, Answer> }
type BuilderQuestion = Omit<Question, "options"> & { options: string[] };
const QUESTION_TYPES = ["text", "textarea", "single_choice", "multi_choice", "number", "date"];

function uid() {
  return "q_" + Math.random().toString(36).slice(2, 10);
}

export default function Forms() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { refresh: refreshNotifications } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const [rows, setRows] = useState<FormRecord[]>([]);
  const [openBuilder, setOpenBuilder] = useState(false);
  const [editing, setEditing] = useState<FormRecord | null>(null);
  const [openFill, setOpenFill] = useState<FormRecord | null>(null);
  const [openResponses, setOpenResponses] = useState<FormRecord | null>(null);

  const load = async () => {
    try {
      setRows((await api.get("/forms")).data);
      refreshNotifications();
    }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setOpenBuilder(true); };
  const openEdit = (f: FormRecord) => { setEditing(f); setOpenBuilder(true); };

  const del = async (id: string) => {
    if (!window.confirm("Delete this form?")) return;
    try { await api.delete(`/forms/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  const toggleActive = async (f: FormRecord) => {
    try {
      await api.patch(`/forms/${f.id}`, { is_active: !f.is_active });
      load();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
  };

  return (
    <div className="space-y-6" data-testid="forms-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("forms")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{rows.length} {t("forms").toLowerCase()}</p>
        </div>
        {isStaff && (
          <Button onClick={openNew} className="gap-2" data-testid="new-form-btn">
            <Plus className="h-4 w-4" /> {t("new_form")}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed col-span-full">
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />{t("no_data")}
          </Card>
        )}
        {rows.map((f) => (
          <Card
            key={f.id}
            className={`p-5 border-slate-200 hover:border-primary/40 transition-colors ${f.is_active ? "" : "opacity-60"}`}
            data-testid={`form-card-${f.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {f.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">{t("form_active")}</Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px]">{t("form_closed")}</Badge>
                  )}
                  {f.my_submitted && (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px] gap-1">
                      <Check className="h-3 w-3" />{t("submitted")}
                    </Badge>
                  )}
                </div>
                <h3 className="text-lg font-semibold mt-2 text-slate-900">{f.title}</h3>
                {f.description && (
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed line-clamp-2">{f.description}</p>
                )}
                <div className="text-[11px] text-muted-foreground mt-2 tabular-nums flex items-center gap-3">
                  <span>{f.questions?.length || 0} {t("form_questions").toLowerCase()}</span>
                  <span>·</span>
                  <span>{f.response_count || 0} {t("responses_count")}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {!isStaff && f.is_active && (
                <Button size="sm" onClick={() => setOpenFill(f)} className="gap-1.5" data-testid={`fill-form-${f.id}`}>
                  <FileEdit className="h-3.5 w-3.5" />
                  {f.my_submitted ? t("edit_response") : t("fill_form")}
                </Button>
              )}
              {isStaff && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setOpenResponses(f)} className="gap-1.5" data-testid={`view-responses-${f.id}`}>
                    <MessageSquare className="h-3.5 w-3.5" /> {t("view_responses")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(f)} data-testid={`edit-form-${f.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleActive(f)} data-testid={`toggle-form-${f.id}`}>
                    {f.is_active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </Button>
                  {user && user.role === "admin" && (
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(f.id)} data-testid={`delete-form-${f.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {openBuilder && (
        <FormBuilder
          open={openBuilder}
          onOpenChange={setOpenBuilder}
          initial={editing}
          onSaved={() => { setOpenBuilder(false); setEditing(null); load(); }}
        />
      )}
      {openFill && (
        <FormFill
          form={openFill}
          onClose={() => setOpenFill(null)}
          onSubmitted={() => { setOpenFill(null); load(); }}
        />
      )}
      {openResponses && (
        <FormResponses form={openResponses} onClose={() => setOpenResponses(null)} />
      )}
    </div>
  );
}

function FormBuilder({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange(open: boolean): void; initial: FormRecord | null; onSaved(): void }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    initial?.questions?.length
      ? initial.questions.map((q) => ({ ...q, options: q.options || [] }))
      : []
  );
  const [saving, setSaving] = useState(false);

  const addQ = () => setQuestions([...questions, { id: uid(), label: "", type: "text", required: false, options: [] }]);
  const rmQ = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx));
  const updQ = (idx: number, patch: Partial<BuilderQuestion>) => setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (questions.length === 0) {
      toast.error(t("no_questions"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title, description, is_active: isActive,
        questions: questions.map((q) => ({
          id: q.id, label: q.label, type: q.type, required: q.required,
          options: (q.type === "single_choice" || q.type === "multi_choice") ? q.options : null,
        })),
      };
      if (initial) await api.patch(`/forms/${initial.id}`, payload);
      else await api.post("/forms", payload);
      toast.success(t("form_saved"));
      onSaved();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? t("edit_form") : t("new_form")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 pt-2" data-testid="form-builder">
          <div className="space-y-1.5">
            <Label>{t("form_title")}</Label>
            <Input required value={title} onChange={(e) => setTitle(e.target.value)} data-testid="form-title-input" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("form_description")}</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="active" className="cursor-pointer">{t("form_active")}</Label>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{t("form_questions")}</Label>
              <Button type="button" size="sm" variant="outline" onClick={addQ} className="gap-1.5" data-testid="add-question-btn">
                <Plus className="h-3.5 w-3.5" /> {t("add_question")}
              </Button>
            </div>

            {questions.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6 rounded-md border border-dashed border-slate-200">
                {t("no_questions")}
              </div>
            )}
            {questions.map((q, idx) => (
              <Card key={q.id} className="p-4 bg-slate-50 border-slate-200" data-testid={`question-item-${idx}`}>
                <div className="flex items-start gap-2">
                  <GripVertical className="h-4 w-4 text-slate-400 mt-2" />
                  <div className="flex-1 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("question_label")}</Label>
                        <Input required value={q.label} onChange={(e) => updQ(idx, { label: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("question_type")}</Label>
                        <Select value={q.type} onValueChange={(v) => updQ(idx, { type: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUESTION_TYPES.map((qt) => (
                              <SelectItem key={qt} value={qt}>{t(`q_${qt}`)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {(q.type === "single_choice" || q.type === "multi_choice") && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("question_options")}</Label>
                        <Textarea
                          rows={3}
                          value={(q.options || []).join("\n")}
                          onChange={(e) => updQ(idx, { options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Switch checked={q.required} onCheckedChange={(v) => updQ(idx, { required: v })} id={`req-${idx}`} />
                      <Label htmlFor={`req-${idx}`} className="text-xs cursor-pointer">{t("question_required")}</Label>
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => rmQ(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving} data-testid="save-form-btn">{saving ? "…" : t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormFill({ form, onClose, onSubmitted }: { form: FormRecord; onClose(): void; onSubmitted(): void }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    if (form.my_submitted) {
      api.get(`/forms/${form.id}/my-response`).then((r) => {
        setAnswers(r.data.answers || {});
        setIsEdit(true);
      }).catch(() => {});
    }
    // eslint-disable-next-line
  }, [form.id]);

  const setA = (qid: string, val: Answer) => setAnswers((a) => ({ ...a, [qid]: val }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Validate required
    for (const q of form.questions) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === "" || v === null || (Array.isArray(v) && v.length === 0)) {
          toast.error(`${t("question_required")}: ${q.label}`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      await api.post(`/forms/${form.id}/responses`, { answers });
      toast.success(t("response_submitted"));
      onSubmitted();
    } catch (e) { toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title}</DialogTitle>
          {form.description && <p className="text-sm text-muted-foreground pt-1 leading-relaxed">{form.description}</p>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5 pt-2" data-testid="form-fill">
          {form.questions.map((q, idx) => (
            <div key={q.id} className="space-y-2" data-testid={`fill-q-${idx}`}>
              <Label className="text-sm font-medium">
                {q.label} {q.required && <span className="text-destructive">*</span>}
              </Label>
              {q.type === "text" && (
                <Input value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => setA(q.id, e.target.value)} />
              )}
              {q.type === "textarea" && (
                <Textarea rows={3} value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => setA(q.id, e.target.value)} />
              )}
              {q.type === "number" && (
                <Input type="number" value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => setA(q.id, e.target.value)} />
              )}
              {q.type === "date" && (
                <Input type="date" value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onChange={(e) => setA(q.id, e.target.value)} />
              )}
              {q.type === "single_choice" && (
                <RadioGroup value={typeof answers[q.id] === "string" ? answers[q.id] as string : ""} onValueChange={(v) => setA(q.id, v)}>
                  {(q.options || []).map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                      <Label htmlFor={`${q.id}-${opt}`} className="text-sm cursor-pointer">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {q.type === "multi_choice" && (
                <div className="space-y-2">
                  {(q.options || []).map((opt) => {
                    const arr = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
                    const checked = arr.includes(opt);
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          id={`${q.id}-${opt}`}
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v ? [...arr, opt] : arr.filter((x) => x !== opt);
                            setA(q.id, next);
                          }}
                        />
                        <Label htmlFor={`${q.id}-${opt}`} className="text-sm cursor-pointer">{opt}</Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t("cancel")}</Button>
            <Button type="submit" disabled={saving} data-testid="submit-response-btn">
              {saving ? "…" : (isEdit ? t("update_response") : t("submit"))}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormResponses({ form, onClose }: { form: FormRecord; onClose(): void }) {
  const { t } = useI18n();
  const [responses, setResponses] = useState<FormResponse[]>([]);

  useEffect(() => {
    api.get(`/forms/${form.id}/responses`).then((r) => setResponses(r.data)).catch(() => {});
  }, [form.id]);

  const qMap = Object.fromEntries((form.questions || []).map((q) => [q.id, q]));
  const exportUrl = `${API}/forms/${form.id}/responses/export`;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pe-6">
            <div>
              <DialogTitle>{form.title}</DialogTitle>
              <p className="text-sm text-muted-foreground pt-1">
                {responses.length} {t("responses_count")}
              </p>
            </div>
            {responses.length > 0 && (
              <a href={exportUrl} download data-testid="export-csv-btn">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> {t("export_csv")}
                </Button>
              </a>
            )}
          </div>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {responses.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">{t("no_data")}</div>
          )}
          {responses.map((r) => (
            <Card key={r.id} className="p-4 border-slate-200" data-testid={`response-${r.id}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-slate-900">{r.user_name}</div>
                <div className="text-[11px] text-muted-foreground tabular-nums">
                  {new Date(r.updated_at || r.submitted_at).toLocaleString()}
                  {r.updated_at && <span className="ms-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">edited</span>}
                </div>
              </div>
              <div className="space-y-2">
                {Object.entries(r.answers || {}).map(([qid, val]) => {
                  const q = qMap[qid];
                  const displayVal = Array.isArray(val) ? val.join(", ") : (val || "—");
                  return (
                    <div key={qid} className="text-sm">
                      <div className="text-xs text-muted-foreground">{q?.label || qid}</div>
                      <div className="text-slate-800">{displayVal}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
