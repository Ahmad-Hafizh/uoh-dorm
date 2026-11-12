"use client";

import axios from "axios";
import { useEffect, useState, useMemo } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Plus, ClipboardList, Trash2, Pencil, MessageSquare, Check, X, GripVertical, FileEdit, Download,
  Copy, Clock, AlertTriangle, FileUp, BarChart3, ListFilter, ExternalLink
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import { FileViewButton } from "@/components/FilePreview";

export type QuestionType =
  | "text"
  | "textarea"
  | "single_choice"
  | "multi_choice"
  | "dropdown"
  | "number"
  | "date"
  | "time"
  | "file";

export interface Question {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  is_required?: boolean;
  options?: string[] | null;
}

export interface FormRecord {
  id: string;
  title: string;
  description: string;
  is_active: boolean;
  closes_at?: string | null;
  is_closed?: boolean;
  questions: Question[];
  response_count: number;
  my_submitted?: boolean;
}

type Answer = string | string[];

export interface FormResponse {
  id: string;
  user_name: string;
  submitted_at: string;
  updated_at: string | null;
  answers: Record<string, Answer>;
}

type BuilderQuestion = Omit<Question, "options"> & { options: string[] };

const QUESTION_TYPES: QuestionType[] = [
  "text",
  "textarea",
  "single_choice",
  "multi_choice",
  "dropdown",
  "number",
  "date",
  "time",
  "file",
];

const CHART_COLORS = ["#2563EB", "#0284C7", "#0D9488", "#16A34A", "#D97706", "#7C3AED", "#DB2777", "#475569"];

function uid() {
  return "q_" + Math.random().toString(36).slice(2, 10);
}

function toDatetimeLocal(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const YYYY = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const DD = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    return `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
  } catch {
    return "";
  }
}

export default function Forms() {
  const { t, lang } = useI18n();
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
      const res = await api.get("/forms");
      setRows(res.data);
      refreshNotifications();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setOpenBuilder(true);
  };

  const openEdit = (f: FormRecord) => {
    setEditing(f);
    setOpenBuilder(true);
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete this form?")) return;
    try {
      await api.delete(`/forms/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  const clone = async (f: FormRecord) => {
    try {
      await api.post(`/forms/${f.id}/clone`);
      toast.success(t("form_cloned"));
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  const toggleActive = async (f: FormRecord) => {
    try {
      await api.patch(`/forms/${f.id}`, { is_active: !f.is_active });
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  return (
    <div className="space-y-6" data-testid="forms-page">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("forms")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length} {t("forms").toLowerCase()}
          </p>
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
            <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("no_data")}
          </Card>
        )}
        {rows.map((f) => {
          const isClosed = Boolean(f.is_closed || (f.closes_at && new Date(f.closes_at).getTime() < Date.now()));
          return (
            <Card
              key={f.id}
              className={`p-5 border-slate-200 hover:border-primary/40 transition-colors ${
                !f.is_active || isClosed ? "opacity-75 bg-slate-50/50" : ""
              }`}
              data-testid={`form-card-${f.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!f.is_active ? (
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 text-[10px]">
                        {t("form_closed")}
                      </Badge>
                    ) : isClosed ? (
                      <Badge variant="destructive" className="text-[10px]">
                        {t("form_closed")}
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">
                        {t("form_active")}
                      </Badge>
                    )}

                    {f.my_submitted && (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px] gap-1">
                        <Check className="h-3 w-3" />
                        {t("submitted")}
                      </Badge>
                    )}

                    {f.closes_at && (
                      <Badge variant="outline" className="text-[10px] gap-1 font-mono text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(f.closes_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold mt-2 text-slate-900">{f.title}</h3>
                  {f.description && (
                    <p className="text-sm text-slate-600 mt-1.5 leading-relaxed line-clamp-2">{f.description}</p>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-2 tabular-nums flex items-center gap-3">
                    <span>
                      {f.questions?.length || 0} {t("form_questions").toLowerCase()}
                    </span>
                    <span>·</span>
                    <span>
                      {f.response_count || 0} {t("responses_count")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!isStaff && (
                  <Button
                    size="sm"
                    disabled={isClosed}
                    onClick={() => setOpenFill(f)}
                    className="gap-1.5"
                    data-testid={`fill-form-${f.id}`}
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    {isClosed ? t("form_closed") : f.my_submitted ? t("edit_response") : t("fill_form")}
                  </Button>
                )}
                {isStaff && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setOpenResponses(f)}
                      className="gap-1.5"
                      data-testid={`view-responses-${f.id}`}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> {t("view_responses")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => clone(f)}
                      title={t("clone_form")}
                      data-testid={`clone-form-${f.id}`}
                    >
                      <Copy className="h-3.5 w-3.5 text-slate-600 hover:text-primary" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(f)}
                      data-testid={`edit-form-${f.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleActive(f)}
                      title={f.is_active ? t("form_closed") : t("form_active")}
                      data-testid={`toggle-form-${f.id}`}
                    >
                      {f.is_active ? <X className="h-3.5 w-3.5 text-slate-600" /> : <Check className="h-3.5 w-3.5 text-emerald-600" />}
                    </Button>
                    {user && user.role === "admin" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => del(f.id)}
                        data-testid={`delete-form-${f.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {openBuilder && (
        <FormBuilder
          open={openBuilder}
          onOpenChange={setOpenBuilder}
          initial={editing}
          onSaved={() => {
            setOpenBuilder(false);
            setEditing(null);
            load();
          }}
        />
      )}
      {openFill && (
        <FormFill
          form={openFill}
          onClose={() => setOpenFill(null)}
          onSubmitted={() => {
            setOpenFill(null);
            load();
          }}
        />
      )}
      {openResponses && (
        <FormResponses form={openResponses} onClose={() => setOpenResponses(null)} />
      )}
    </div>
  );
}

function FormBuilder({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange(open: boolean): void;
  initial: FormRecord | null;
  onSaved(): void;
}) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [closesAt, setClosesAt] = useState(toDatetimeLocal(initial?.closes_at));
  const [questions, setQuestions] = useState<BuilderQuestion[]>(
    initial?.questions?.length
      ? initial.questions.map((q) => ({
          ...q,
          is_required: Boolean(q.is_required || q.required),
          required: Boolean(q.is_required || q.required),
          options: q.options || [],
        }))
      : []
  );
  const [saving, setSaving] = useState(false);

  const addQ = () =>
    setQuestions([
      ...questions,
      { id: uid(), label: "", type: "text", required: false, is_required: false, options: [] },
    ]);
  const rmQ = (idx: number) => setQuestions(questions.filter((_, i) => i !== idx));
  const updQ = (idx: number, patch: Partial<BuilderQuestion>) =>
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (questions.length === 0) {
      toast.error(t("no_questions"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        is_active: isActive,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        questions: questions.map((q) => ({
          id: q.id,
          label: q.label,
          type: q.type,
          is_required: Boolean(q.is_required || q.required),
          required: Boolean(q.is_required || q.required),
          options:
            q.type === "single_choice" || q.type === "multi_choice" || q.type === "dropdown"
              ? q.options
              : null,
        })),
      };
      if (initial) await api.patch(`/forms/${initial.id}`, payload);
      else await api.post("/forms", payload);
      toast.success(t("form_saved"));
      onSaved();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSaving(false);
    }
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
            <Input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="form-title-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("form_description")}</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-1 border-t border-slate-100">
            {/* Active Toggle */}
            <div className="flex items-center gap-2 pt-2">
              <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
              <Label htmlFor="active" className="cursor-pointer">
                {t("form_active")}
              </Label>
            </div>

            {/* Deadline / Closes At */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="closes_at" className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {t("form_deadline")}
                </Label>
                {closesAt && (
                  <button
                    type="button"
                    onClick={() => setClosesAt("")}
                    className="text-[11px] text-destructive hover:underline"
                  >
                    {lang === "ar" ? "إلغاء الموعد" : "Clear"}
                  </button>
                )}
              </div>
              <Input
                id="closes_at"
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>

          {/* Question Builder */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">{t("form_questions")}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addQ}
                className="gap-1.5"
                data-testid="add-question-btn"
              >
                <Plus className="h-3.5 w-3.5" /> {t("add_question")}
              </Button>
            </div>

            {questions.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6 rounded-md border border-dashed border-slate-200">
                {t("no_questions")}
              </div>
            )}

            {questions.map((q, idx) => {
              const needsOptions =
                q.type === "single_choice" || q.type === "multi_choice" || q.type === "dropdown";
              return (
                <Card
                  key={q.id}
                  className="p-4 bg-slate-50 border-slate-200"
                  data-testid={`question-item-${idx}`}
                >
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-slate-400 mt-2 shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("question_label")}</Label>
                          <Input
                            required
                            value={q.label}
                            onChange={(e) => updQ(idx, { label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("question_type")}</Label>
                          <Select
                            value={q.type}
                            onValueChange={(v) => updQ(idx, { type: v as QuestionType })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {QUESTION_TYPES.map((qt) => (
                                <SelectItem key={qt} value={qt}>
                                  {t(`q_${qt}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {needsOptions && (
                        <div className="space-y-1.5">
                          <Label className="text-xs">{t("question_options")}</Label>
                          <Textarea
                            rows={3}
                            placeholder={lang === "ar" ? "أدخل خياراً في كل سطر" : "One option per line"}
                            value={(q.options || []).join("\n")}
                            onChange={(e) =>
                              updQ(idx, {
                                options: e.target.value
                                  .split("\n")
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          checked={Boolean(q.is_required || q.required)}
                          onCheckedChange={(v) => updQ(idx, { required: v, is_required: v })}
                          id={`req-${idx}`}
                        />
                        <Label htmlFor={`req-${idx}`} className="text-xs cursor-pointer">
                          {t("question_required")}
                        </Label>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive shrink-0"
                      onClick={() => rmQ(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={saving} data-testid="save-form-btn">
              {saving ? "…" : t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormFill({
  form,
  onClose,
  onSubmitted,
}: {
  form: FormRecord;
  onClose(): void;
  onSubmitted(): void;
}) {
  const { t, lang } = useI18n();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  const isClosed = Boolean(
    form.is_closed || (form.closes_at && new Date(form.closes_at).getTime() < Date.now())
  );

  useEffect(() => {
    if (form.my_submitted) {
      api
        .get(`/forms/${form.id}/my-response`)
        .then((r) => {
          setAnswers(r.data.answers || {});
          setIsEdit(true);
        })
        .catch(() => {});
    }
  }, [form.id, form.my_submitted]);

  const setA = (qid: string, val: Answer) => setAnswers((a) => ({ ...a, [qid]: val }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isClosed) {
      toast.error(t("form_closed_warning"));
      return;
    }

    // Front-end validation respecting is_required
    for (const q of form.questions) {
      const isReq = Boolean(q.is_required || q.required);
      if (isReq) {
        const v = answers[q.id];
        const empty =
          v === undefined ||
          v === "" ||
          v === null ||
          (Array.isArray(v) && v.length === 0);
        if (empty) {
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
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title}</DialogTitle>
          {form.description && (
            <p className="text-sm text-muted-foreground pt-1 leading-relaxed">{form.description}</p>
          )}
          {form.closes_at && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-md mt-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("form_deadline")}:{" "}
                {new Date(form.closes_at).toLocaleString(lang === "ar" ? "ar-SA" : "en-US")}
              </span>
            </div>
          )}
        </DialogHeader>

        {isClosed && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{t("form_closed")}</AlertTitle>
            <AlertDescription>{t("form_closed_warning")}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={submit} className="space-y-5 pt-2" data-testid="form-fill">
          {form.questions.map((q, idx) => {
            const isReq = Boolean(q.is_required || q.required);
            const val = answers[q.id];
            const strVal = typeof val === "string" ? val : "";

            return (
              <div key={q.id} className="space-y-2" data-testid={`fill-q-${idx}`}>
                <Label className="text-sm font-medium">
                  {q.label} {isReq && <span className="text-destructive">*</span>}
                </Label>

                {q.type === "text" && (
                  <Input
                    disabled={isClosed}
                    value={strVal}
                    onChange={(e) => setA(q.id, e.target.value)}
                  />
                )}

                {q.type === "textarea" && (
                  <Textarea
                    disabled={isClosed}
                    rows={3}
                    value={strVal}
                    onChange={(e) => setA(q.id, e.target.value)}
                  />
                )}

                {q.type === "number" && (
                  <Input
                    disabled={isClosed}
                    type="number"
                    value={strVal}
                    onChange={(e) => setA(q.id, e.target.value)}
                  />
                )}

                {q.type === "date" && (
                  <Input
                    disabled={isClosed}
                    type="date"
                    value={strVal}
                    onChange={(e) => setA(q.id, e.target.value)}
                  />
                )}

                {q.type === "time" && (
                  <Input
                    disabled={isClosed}
                    type="time"
                    value={strVal}
                    onChange={(e) => setA(q.id, e.target.value)}
                  />
                )}

                {q.type === "dropdown" && (
                  <Select
                    disabled={isClosed}
                    value={strVal}
                    onValueChange={(v) => setA(q.id, v)}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder={t("dropdown_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {q.type === "file" && (
                  <div className="space-y-1.5">
                    <FileUpload
                      kind="forms"
                      value={strVal || null}
                      onChange={(fileId) => setA(q.id, fileId || "")}
                    />
                  </div>
                )}

                {q.type === "single_choice" && (
                  <RadioGroup
                    disabled={isClosed}
                    value={strVal}
                    onValueChange={(v) => setA(q.id, v)}
                  >
                    {(q.options || []).map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`} className="text-sm cursor-pointer">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {q.type === "multi_choice" && (
                  <div className="space-y-2">
                    {(q.options || []).map((opt) => {
                      const arr = Array.isArray(val) ? (val as string[]) : [];
                      const checked = arr.includes(opt);
                      return (
                        <div key={opt} className="flex items-center gap-2">
                          <Checkbox
                            disabled={isClosed}
                            id={`${q.id}-${opt}`}
                            checked={checked}
                            onCheckedChange={(v) => {
                              const next = v ? [...arr, opt] : arr.filter((x) => x !== opt);
                              setA(q.id, next);
                            }}
                          />
                          <Label htmlFor={`${q.id}-${opt}`} className="text-sm cursor-pointer">
                            {opt}
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("cancel")}
            </Button>
            {!isClosed && (
              <Button type="submit" disabled={saving} data-testid="submit-response-btn">
                {saving ? "…" : isEdit ? t("update_response") : t("submit")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormResponses({ form, onClose }: { form: FormRecord; onClose(): void }) {
  const { t, lang } = useI18n();
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    api
      .get(`/forms/${form.id}/responses`)
      .then((r) => setResponses(r.data))
      .catch(() => {});
  }, [form.id]);

  const qMap = useMemo(
    () => Object.fromEntries((form.questions || []).map((q) => [q.id, q])),
    [form.questions]
  );

  const exportUrl = `${API}/forms/${form.id}/export`;

  // Compute distribution data for choice questions
  const summaries = useMemo(() => {
    return form.questions.map((q) => {
      const isChoice =
        q.type === "single_choice" || q.type === "multi_choice" || q.type === "dropdown";

      if (!isChoice) {
        // Collect text responses
        const entries = responses
          .map((r) => ({ user: r.user_name, val: r.answers[q.id] }))
          .filter((e) => e.val != null && e.val !== "");
        return {
          question: q,
          isChoice: false,
          totalAnswered: entries.length,
          entries,
        };
      }

      // Count occurrences
      const counts: Record<string, number> = {};
      for (const opt of q.options || []) {
        counts[opt] = 0;
      }
      let totalPicks = 0;

      for (const r of responses) {
        const a = r.answers[q.id];
        if (Array.isArray(a)) {
          for (const item of a) {
            counts[item] = (counts[item] || 0) + 1;
            totalPicks++;
          }
        } else if (a && typeof a === "string") {
          counts[a] = (counts[a] || 0) + 1;
          totalPicks++;
        }
      }

      const chartData = Object.entries(counts).map(([name, count]) => ({
        name,
        count,
        percent: responses.length > 0 ? Math.round((count / responses.length) * 100) : 0,
      }));

      return {
        question: q,
        isChoice: true,
        totalPicks,
        chartData,
      };
    });
  }, [form.questions, responses]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 pe-6">
            <div>
              <DialogTitle className="text-xl">{form.title}</DialogTitle>
              <p className="text-sm text-muted-foreground pt-1">
                {responses.length} {t("responses_count")}
              </p>
            </div>
            {responses.length > 0 && (
              <a href={exportUrl} download data-testid="export-excel-btn">
                <Button size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50">
                  <Download className="h-3.5 w-3.5" />
                  {t("export_excel")}
                </Button>
              </a>
            )}
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="pt-2">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 p-1">
            <TabsTrigger value="summary" className="gap-1.5 text-xs">
              <BarChart3 className="h-4 w-4" /> {t("responses_summary")}
            </TabsTrigger>
            <TabsTrigger value="individual" className="gap-1.5 text-xs">
              <ListFilter className="h-4 w-4" /> {t("responses_table")} ({responses.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Visual Summary */}
          <TabsContent value="summary" className="space-y-4">
            {responses.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">{t("no_data")}</div>
            ) : (
              summaries.map((s, idx) => (
                <Card key={s.question.id} className="p-4 border-slate-200">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 mb-3">
                    <h4 className="font-semibold text-sm text-slate-900">
                      <span className="text-muted-foreground me-1.5">{idx + 1}.</span>
                      {s.question.label}
                    </h4>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`q_${s.question.type}`)}
                    </Badge>
                  </div>

                  {s.isChoice && s.chartData ? (
                    <div className="space-y-4">
                      {/* Responsive Visual Bar Chart */}
                      <div className="h-44 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={s.chartData} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                            <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
                            <Tooltip
                              formatter={(value) => [`${value} ${t("responses_count")}`, "Total"]}
                              contentStyle={{ fontSize: 12, borderRadius: 6 }}
                            />
                            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                              {s.chartData.map((_, i) => (
                                <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Percentage breakdown bars */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {s.chartData.map((item, i) => (
                          <div key={item.name} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-800">{item.name}</span>
                              <span className="text-muted-foreground tabular-nums">
                                {item.count} ({item.percent}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width: `${item.percent}%`,
                                  backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        {s.totalAnswered} / {responses.length} {t("responses_count")}
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1.5 divide-y divide-slate-100">
                        {s.entries?.map((entry, i) => {
                          const valStr = Array.isArray(entry.val) ? entry.val.join(", ") : String(entry.val);
                          const isFileId = s.question.type === "file" && typeof entry.val === "string" && entry.val.startsWith("file-");

                          return (
                            <div key={i} className="pt-1.5 flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground font-medium">{entry.user}:</span>
                              {isFileId ? (
                                <FileViewButton fileId={valStr} className="text-primary hover:underline text-xs flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> {lang === "ar" ? "معاينة الملف" : "View File"}
                                </FileViewButton>
                              ) : (
                                <span className="text-slate-800 text-end font-mono">{valStr}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              ))
            )}
          </TabsContent>

          {/* Tab 2: Individual Responses Table / Cards */}
          <TabsContent value="individual" className="space-y-3">
            {responses.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">{t("no_data")}</div>
            )}
            {responses.map((r) => (
              <Card key={r.id} className="p-4 border-slate-200" data-testid={`response-${r.id}`}>
                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                  <div className="text-sm font-semibold text-slate-900">{r.user_name}</div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(r.updated_at || r.submitted_at).toLocaleString()}
                    {r.updated_at && (
                      <span className="ms-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">
                        edited
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(r.answers || {}).map(([qid, val]) => {
                    const q = qMap[qid];
                    const isFile = q?.type === "file" && typeof val === "string" && val.startsWith("file-");
                    const displayVal = Array.isArray(val) ? val.join(", ") : val || "—";

                    return (
                      <div key={qid} className="text-sm">
                        <div className="text-xs text-muted-foreground">{q?.label || qid}</div>
                        {isFile ? (
                          <FileViewButton fileId={String(val)} className="text-primary hover:underline text-xs inline-flex items-center gap-1 mt-0.5">
                            <ExternalLink className="h-3 w-3" /> {lang === "ar" ? "معاينة المرفق" : "View attachment"}
                          </FileViewButton>
                        ) : (
                          <div className="text-slate-800">{displayVal}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
