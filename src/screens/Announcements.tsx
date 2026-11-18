"use client";

import axios from "axios";
import Link from "next/link";
import React, { useEffect, useState, useMemo, useRef } from "react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Megaphone,
  Trash2,
  Pin,
  Pencil,
  Search,
  AlertTriangle,
  Bus,
  ShieldCheck,
  Calendar,
  Check,
  CheckCircle2,
  ExternalLink,
  X,
  FileText,
  ChevronDown,
  ChevronUp,
  FileEdit,
  Clock,
  Bold,
  Italic,
  Heading3,
  List,
  ListOrdered,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import FilePreview from "@/components/FilePreview";

type CategoryType = "GENERAL" | "URGENT" | "TRANSPORT" | "IMMIGRATION" | "EVENT";

interface AnnouncementFormStatus {
  form_id: string;
  title?: string;
  is_active: boolean;
  is_closed: boolean;
  has_responded: boolean;
  closes_at?: string | null;
  question_count?: number;
}

interface Announcement {
  id: string;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: CategoryType | string;
  attachment_file_ids?: string[] | null;
  acknowledged_by?: string[];
  acknowledged_count?: number;
  has_acknowledged?: boolean;
  pinned: boolean;
  created_at: string;
  author_name: string;
  form_id?: string | null;
  form_status?: AnnouncementFormStatus | null;
}

interface NewAnnouncementForm {
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  category: CategoryType;
  attachment_file_ids: string[];
  pinned: boolean;
}

const EMPTY_FORM: NewAnnouncementForm = {
  title_en: "",
  title_ar: "",
  body_en: "",
  body_ar: "",
  category: "GENERAL",
  attachment_file_ids: [],
  pinned: false,
};

// ── Helper: Inline Markdown Formatter ─────────────────────────────────────────
function formatInline(text: string): React.ReactNode[] {
  const regex = /(\[[^\]]+\]\([^\)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    // Link: [label](url)
    if (part.startsWith("[") && part.includes("](") && part.endsWith(")")) {
      const match = part.match(/^\[([^\]]+)\]\(([^\)]+)\)$/);
      if (match) {
        const [, label, rawUrl] = match;
        const url = /^(https?:\/\/|mailto:|\/)/i.test(rawUrl.trim())
          ? rawUrl.trim()
          : `https://${rawUrl.trim()}`;
        return (
          <a
            key={index}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline hover:text-primary/80 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </a>
        );
      }
    }
    // Bold: **text**
    if (part.startsWith("**") && part.endsWith("**") && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    // Italic: *text*
    if (part.startsWith("*") && part.endsWith("*") && part.length >= 2) {
      return (
        <em key={index} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    // Plain text
    return <span key={index}>{part}</span>;
  });
}

// ── Component: Rich Text Content Renderer ─────────────────────────────────────
export function RichTextContent({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  if (!text) return null;

  const lines = text.split(/\r?\n/);
  interface Block {
    type: "p" | "h2" | "h3" | "h4" | "bullet" | "numbered";
    content?: string;
    items?: string[];
  }

  const blocks: Block[] = [];
  let currentList: { type: "bullet" | "numbered"; items: string[] } | null = null;
  let currentPara: string[] = [];

  const flushList = () => {
    if (currentList) {
      blocks.push(currentList);
      currentList = null;
    }
  };

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: "p", content: currentPara.join("\n") });
      currentPara = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      flushPara();
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      flushPara();
      const level = headingMatch[1].length;
      blocks.push({
        type: level === 1 ? "h2" : level === 2 ? "h3" : "h4",
        content: headingMatch[2],
      });
      continue;
    }

    // Bullet list
    const bulletMatch = line.match(/^[\•\-\*]\s+(.*)$/);
    if (bulletMatch) {
      flushPara();
      if (!currentList || currentList.type !== "bullet") {
        flushList();
        currentList = { type: "bullet", items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Numbered list
    const numMatch = line.match(/^\d+[\.\)]\s+(.*)$/);
    if (numMatch) {
      flushPara();
      if (!currentList || currentList.type !== "numbered") {
        flushList();
        currentList = { type: "numbered", items: [] };
      }
      currentList.items.push(numMatch[1]);
      continue;
    }

    // Paragraph
    flushList();
    currentPara.push(line);
  }

  flushList();
  flushPara();

  return (
    <div className={`space-y-1.5 text-sm ${className}`}>
      {blocks.map((block, bIdx) => {
        if (block.type === "h2") {
          return (
            <h2 key={bIdx} className="text-base font-bold text-slate-900 mt-2 first:mt-0">
              {formatInline(block.content || "")}
            </h2>
          );
        }
        if (block.type === "h3") {
          return (
            <h3 key={bIdx} className="text-sm font-bold text-slate-900 mt-1.5 first:mt-0">
              {formatInline(block.content || "")}
            </h3>
          );
        }
        if (block.type === "h4") {
          return (
            <h4 key={bIdx} className="text-xs sm:text-sm font-semibold text-slate-900 mt-1 first:mt-0">
              {formatInline(block.content || "")}
            </h4>
          );
        }
        if (block.type === "bullet") {
          return (
            <ul key={bIdx} className="list-disc ps-5 space-y-0.5 text-slate-700 my-1">
              {block.items?.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {formatInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "numbered") {
          return (
            <ol key={bIdx} className="list-decimal ps-5 space-y-0.5 text-slate-700 my-1">
              {block.items?.map((item, iIdx) => (
                <li key={iIdx} className="leading-relaxed">
                  {formatInline(item)}
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={bIdx} className="text-slate-600 leading-relaxed whitespace-pre-line">
            {formatInline(block.content || "")}
          </p>
        );
      })}
    </div>
  );
}

// ── Component: Rich Text Editor Area with Toolbar & Preview ──────────────────
function RichTextEditorArea({
  label,
  value,
  onChange,
  dir = "ltr",
  required = false,
  t,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  dir?: "ltr" | "rtl";
  required?: boolean;
  t: (k: string) => string;
}) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyFormat = (
    type: "bold" | "italic" | "heading" | "bullet" | "numbered" | "link"
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.substring(start, end);
    let replacement = "";
    let cursorOffset = 0;

    switch (type) {
      case "bold":
        replacement = `**${selected || "bold text"}**`;
        cursorOffset = selected ? replacement.length : 2;
        break;
      case "italic":
        replacement = `*${selected || "italic text"}*`;
        cursorOffset = selected ? replacement.length : 1;
        break;
      case "heading":
        replacement = `\n### ${selected || "Heading"}\n`;
        cursorOffset = replacement.length;
        break;
      case "bullet":
        replacement = selected
          ? selected
              .split("\n")
              .map((l) => `• ${l}`)
              .join("\n")
          : `\n• ${selected || "List item"}\n`;
        cursorOffset = replacement.length;
        break;
      case "numbered":
        replacement = selected
          ? selected
              .split("\n")
              .map((l, i) => `${i + 1}. ${l}`)
              .join("\n")
          : `\n1. ${selected || "List item"}\n`;
        cursorOffset = replacement.length;
        break;
      case "link": {
        const url = prompt("Enter URL (e.g. https://uoh.edu.sa):") || "https://";
        replacement = `[${selected || "link text"}](${url})`;
        cursorOffset = replacement.length;
        break;
      }
    }

    const nextVal = value.substring(0, start) + replacement + value.substring(end);
    onChange(nextVal);

    setTimeout(() => {
      textarea.focus();
      const pos = start + cursorOffset;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`px-2 py-0.5 rounded transition ${
              mode === "write"
                ? "bg-white font-medium text-slate-900 shadow-xs"
                : "text-muted-foreground hover:text-slate-800"
            }`}
          >
            {t("write_mode")}
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`px-2 py-0.5 rounded transition ${
              mode === "preview"
                ? "bg-white font-medium text-slate-900 shadow-xs"
                : "text-muted-foreground hover:text-slate-800"
            }`}
          >
            {t("preview_mode")}
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <div className="rounded-md border border-slate-200 bg-white shadow-xs focus-within:ring-1 focus-within:ring-primary/40 focus-within:border-primary">
          {/* Formatting Toolbar */}
          <div className="flex items-center gap-1 border-b border-slate-100 p-1.5 bg-slate-50/70 text-slate-700">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("bold")}
              title={t("format_bold")}
              className="h-7 w-7 p-0"
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("italic")}
              title={t("format_italic")}
              className="h-7 w-7 p-0"
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("heading")}
              title={t("format_heading")}
              className="h-7 w-7 p-0"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-slate-200 mx-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("bullet")}
              title={t("format_bullet")}
              className="h-7 w-7 p-0"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("numbered")}
              title={t("format_numbered")}
              className="h-7 w-7 p-0"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
            <div className="h-4 w-px bg-slate-200 mx-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyFormat("link")}
              title={t("format_link")}
              className="h-7 w-7 p-0"
            >
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Textarea
            ref={textareaRef}
            required={required}
            rows={4}
            dir={dir}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 rounded-t-none resize-y text-xs sm:text-sm font-sans"
          />
        </div>
      ) : (
        <div
          dir={dir}
          className="min-h-[125px] max-h-[220px] overflow-y-auto p-3 rounded-md border border-slate-200 bg-slate-50/50"
        >
          {value.trim() ? (
            <RichTextContent text={value} />
          ) : (
            <span className="text-xs text-muted-foreground italic">
              {t("no_data")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Screen: Announcements ────────────────────────────────────────────────
export default function Announcements() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { markRead } = useNotifications();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");

  const [rows, setRows] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewAnnouncementForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "pinned" | "forms" | "urgent">("all");
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | "ALL">("ALL");
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const load = async () => {
    try {
      const res = await api.get("/announcements");
      setRows(res.data);
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    }
  };

  useEffect(() => {
    load();
    if (user && user.role === "student") {
      markRead("announcements");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const togglePin = async (a: Announcement) => {
    try {
      await api.patch(`/announcements/${a.id}`, { pinned: !a.pinned });
      toast.success(!a.pinned ? t("pinned_success") : t("unpinned_success"));
      load();
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    }
  };

  const handleAcknowledge = async (id: string) => {
    setAcknowledging(id);
    try {
      await api.post(`/announcements/${id}/acknowledge`);
      toast.success(t("acknowledged_success"));
      load();
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    } finally {
      setAcknowledging(null);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title_en: a.title_en,
      title_ar: a.title_ar,
      body_en: a.body_en,
      body_ar: a.body_ar,
      category: (a.category as CategoryType) || "GENERAL",
      attachment_file_ids: a.attachment_file_ids ? [...a.attachment_file_ids] : [],
      pinned: Boolean(a.pinned),
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/announcements/${editingId}`, form);
        toast.success(t("updated_success"));
      } else {
        await api.post("/announcements", form);
        toast.success("Published");
      }
      setOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!window.confirm("Delete announcement?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(
        formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined)
      );
    }
  };

  const filteredRows = useMemo(() => {
    return rows.filter((a) => {
      // 1. Tab filter
      if (tabFilter === "pinned" && !a.pinned) return false;
      if (tabFilter === "forms" && !a.form_id) return false;
      if (tabFilter === "urgent" && a.category !== "URGENT") return false;

      // 2. Category Dropdown filter
      if (selectedCategory !== "ALL" && a.category !== selectedCategory) return false;

      // 3. Search query filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchEn =
          a.title_en?.toLowerCase().includes(q) ||
          a.body_en?.toLowerCase().includes(q);
        const matchAr =
          a.title_ar?.toLowerCase().includes(q) ||
          a.body_ar?.toLowerCase().includes(q);
        if (!matchEn && !matchAr) return false;
      }
      return true;
    });
  }, [rows, tabFilter, selectedCategory, search]);

  const removeAttachment = (fileId: string) => {
    setForm((prev) => ({
      ...prev,
      attachment_file_ids: prev.attachment_file_ids.filter((id) => id !== fileId),
    }));
  };

  const renderCategoryBadge = (category: string) => {
    switch (category) {
      case "URGENT":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 gap-1 font-medium text-[11px]"
          >
            <AlertTriangle className="h-3 w-3 text-red-600" />
            {t("cat_urgent")}
          </Badge>
        );
      case "TRANSPORT":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-800 border-amber-200 gap-1 font-medium text-[11px]"
          >
            <Bus className="h-3 w-3 text-amber-600" />
            {t("cat_transport")}
          </Badge>
        );
      case "IMMIGRATION":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 gap-1 font-medium text-[11px]"
          >
            <ShieldCheck className="h-3 w-3 text-blue-600" />
            {t("cat_immigration")}
          </Badge>
        );
      case "EVENT":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200 gap-1 font-medium text-[11px]"
          >
            <Calendar className="h-3 w-3 text-purple-600" />
            {t("cat_event")}
          </Badge>
        );
      case "GENERAL":
      default:
        return (
          <Badge
            variant="outline"
            className="bg-slate-50 text-slate-700 border-slate-200 gap-1 font-medium text-[11px]"
          >
            <Megaphone className="h-3 w-3 text-slate-500" />
            {t("cat_general")}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6" data-testid="announcements-page">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            {t("announcements")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length} {t("announcements").toLowerCase()}
          </p>
        </div>
        {isStaff && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew} className="gap-2 shadow-xs" data-testid="new-announcement-btn">
                <Plus className="h-4 w-4" />
                {t("new_announcement")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingId ? t("edit_announcement") : t("new_announcement")}
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={submit}
                className="space-y-4 pt-2"
                data-testid="announcement-form"
              >
                {/* Titles */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("title_en")}</Label>
                    <Input
                      required
                      value={form.title_en}
                      onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("title_ar")}</Label>
                    <Input
                      required
                      dir="rtl"
                      value={form.title_ar}
                      onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                    />
                  </div>
                </div>

                {/* Bodies with Rich Text Toolbar & Preview */}
                <RichTextEditorArea
                  label={t("body_en")}
                  value={form.body_en}
                  onChange={(val) => setForm({ ...form, body_en: val })}
                  dir="ltr"
                  required
                  t={t}
                />
                <RichTextEditorArea
                  label={t("body_ar")}
                  value={form.body_ar}
                  onChange={(val) => setForm({ ...form, body_ar: val })}
                  dir="rtl"
                  required
                  t={t}
                />

                {/* Category & Pin */}
                <div className="grid gap-4 sm:grid-cols-2 items-end">
                  <div className="space-y-1.5">
                    <Label>{t("category")}</Label>
                    <Select
                      value={form.category}
                      onValueChange={(val: CategoryType) =>
                        setForm({ ...form, category: val })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GENERAL">{t("cat_general")}</SelectItem>
                        <SelectItem value="URGENT">{t("cat_urgent")}</SelectItem>
                        <SelectItem value="TRANSPORT">{t("cat_transport")}</SelectItem>
                        <SelectItem value="IMMIGRATION">{t("cat_immigration")}</SelectItem>
                        <SelectItem value="EVENT">{t("cat_event")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 pb-2">
                    <Switch
                      id="pin"
                      checked={form.pinned}
                      onCheckedChange={(v) => setForm({ ...form, pinned: v })}
                    />
                    <Label htmlFor="pin" className="cursor-pointer">
                      {t("pin")}
                    </Label>
                  </div>
                </div>

                {/* Media Attachments (Max 2 files) */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-slate-700">
                      {t("attachments")} ({form.attachment_file_ids.length}/2)
                    </Label>
                    {form.attachment_file_ids.length >= 2 && (
                      <span className="text-[11px] text-muted-foreground">
                        {t("max_files_reached")}
                      </span>
                    )}
                  </div>

                  {/* List of currently attached files */}
                  {form.attachment_file_ids.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {form.attachment_file_ids.map((fileId) => (
                        <div
                          key={fileId}
                          className="relative group rounded-md border border-slate-200 p-1.5 bg-slate-50"
                        >
                          <FilePreview fileId={fileId} />
                          <button
                            type="button"
                            onClick={() => removeAttachment(fileId)}
                            className="absolute top-2 end-2 p-1 rounded-full bg-destructive text-white hover:bg-destructive/90 shadow-xs transition"
                            title={t("delete")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* FileUpload input if fewer than 2 files */}
                  {form.attachment_file_ids.length < 2 && (
                    <FileUpload
                      kind="announcements"
                      value={null}
                      onChange={(id) => {
                        if (id && !form.attachment_file_ids.includes(id)) {
                          setForm((prev) => ({
                            ...prev,
                            attachment_file_ids: [...prev.attachment_file_ids, id],
                          }));
                        }
                      }}
                      accept="image/*,.pdf"
                      label={t("upload_attachment")}
                    />
                  )}
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    {t("cancel")}
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    data-testid="announcement-submit"
                  >
                    {t("submit")}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* ── Search Bar, Category Dropdown & Filter Tabs ─────────────── */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("search_announcements")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 pe-8 h-9 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Full Category Dropdown Filter */}
          <Select
            value={selectedCategory}
            onValueChange={(val) =>
              setSelectedCategory(val as CategoryType | "ALL")
            }
          >
            <SelectTrigger className="w-full sm:w-[210px] h-9 text-xs">
              <SelectValue placeholder={t("all_categories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("all_categories")}</SelectItem>
              <SelectItem value="GENERAL">{t("cat_general")}</SelectItem>
              <SelectItem value="URGENT">{t("cat_urgent")}</SelectItem>
              <SelectItem value="TRANSPORT">{t("cat_transport")}</SelectItem>
              <SelectItem value="IMMIGRATION">{t("cat_immigration")}</SelectItem>
              <SelectItem value="EVENT">{t("cat_event")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filter Tabs */}
        <Tabs
          value={tabFilter}
          onValueChange={(v) =>
            setTabFilter(v as "all" | "pinned" | "forms" | "urgent")
          }
          className="w-auto shrink-0"
        >
          <TabsList className="grid grid-cols-4 h-9">
            <TabsTrigger value="all" className="text-xs px-2.5">
              {t("filter_all")}
            </TabsTrigger>
            <TabsTrigger value="pinned" className="text-xs px-2.5">
              {t("pinned")}
            </TabsTrigger>
            <TabsTrigger value="forms" className="text-xs px-2.5">
              {t("filter_forms")}
            </TabsTrigger>
            <TabsTrigger value="urgent" className="text-xs px-2.5">
              {t("cat_urgent")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Announcements Cards List ────────────────────────────────── */}
      <div className="grid gap-4">
        {filteredRows.length === 0 && (
          <Card className="p-10 border-slate-200 text-center text-muted-foreground border-dashed">
            <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("no_data")}
          </Card>
        )}

        {filteredRows.map((a) => {
          const title = lang === "ar" ? a.title_ar : a.title_en;
          const body = lang === "ar" ? a.body_ar : a.body_en;
          const isUrgent = a.category === "URGENT";
          const isExpanded = expandedCards.has(a.id);
          const isLong = body.length > 220;
          const isUrgentOrPinned = isUrgent || a.pinned;

          return (
            <Card
              key={a.id}
              className={`p-5 transition-all duration-200 ${
                isUrgent
                  ? "border-red-300 bg-red-50/30 ring-1 ring-red-200/50"
                  : a.pinned
                  ? "border-primary/30 ring-1 ring-primary/20 bg-primary/[0.02]"
                  : "border-slate-200 hover:border-primary/30"
              }`}
              data-testid={`ann-${a.id}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {/* Badge bar: Category, Pinned, Date */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {renderCategoryBadge(a.category)}
                    {a.pinned && (
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15 gap-1 text-[11px]">
                        <Pin className="h-3 w-3" />
                        {t("pinned")}
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Title */}
                  <div className="flex items-center gap-2 mt-2">
                    {isUrgent && (
                      <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    )}
                    <h3
                      className={`text-lg font-semibold tracking-tight ${
                        isUrgent ? "text-red-950 font-bold" : "text-slate-900"
                      }`}
                    >
                      {title}
                    </h3>
                  </div>

                  {/* Formatted Rich Text Body with Read more / Show less toggle */}
                  <div className="mt-2">
                    <div
                      className={
                        !isExpanded && isLong
                          ? "line-clamp-3 overflow-hidden relative"
                          : ""
                      }
                    >
                      <RichTextContent text={body} />
                    </div>
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(a.id)}
                        className="text-xs text-primary font-medium hover:underline mt-1.5 inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        {isExpanded ? (
                          <>
                            <span>{t("show_less")}</span>
                            <ChevronUp className="h-3 w-3" />
                          </>
                        ) : (
                          <>
                            <span>{t("read_more")}</span>
                            <ChevronDown className="h-3 w-3" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Media Attachments Preview */}
                  {a.attachment_file_ids && a.attachment_file_ids.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-100/80 space-y-2">
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span>{t("attachments")}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {a.attachment_file_ids.map((fileId) => (
                          <FilePreview key={fileId} fileId={fileId} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Smart Form Integration Section (No duplicate badges) ─ */}
                  {a.form_id && (
                    <div className="mt-4 p-3.5 rounded-lg border border-slate-200/90 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
                      {/* Left: Form icon, Form title & Deadline/Questions info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
                          <FileEdit className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">
                            {a.form_status?.title || t("forms")}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                            {a.form_status?.closes_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span>
                                  {t("closes_at_label")}:{" "}
                                  {new Date(a.form_status.closes_at).toLocaleDateString()}
                                </span>
                              </span>
                            )}
                            {a.form_status?.question_count ? (
                              <span>
                                {a.form_status.closes_at && "· "}
                                {a.form_status.question_count} {t("questions_count_label")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Sole action & status area */}
                      <div className="flex items-center gap-2 ms-auto sm:ms-0">
                        {!isStaff ? (
                          a.form_status?.has_responded ? (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 gap-1 text-[11px] font-medium h-7">
                                <Check className="h-3 w-3" />
                                {t("form_completed_badge")}
                              </Badge>
                              <Link href={`/forms?formId=${a.form_id}`}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1.5 text-xs font-medium"
                                >
                                  <FileEdit className="h-3.5 w-3.5" />
                                  <span>{t("view_edit_response")}</span>
                                </Button>
                              </Link>
                            </div>
                          ) : a.form_status?.is_closed || !a.form_status?.is_active ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled
                              className="h-8 text-xs cursor-not-allowed opacity-60"
                            >
                              <span>{t("form_closed_badge")}</span>
                            </Button>
                          ) : (
                            <Link href={`/forms?formId=${a.form_id}`}>
                              <Button
                                size="sm"
                                className="h-8 gap-1.5 text-xs font-medium shadow-xs"
                              >
                                <span>{t("fill_out_form")}</span>
                                <span>{lang === "ar" ? "←" : "→"}</span>
                              </Button>
                            </Link>
                          )
                        ) : (
                          <Link href={`/forms?formId=${a.form_id}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs font-medium"
                            >
                              <span>{t("view_responses")}</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Footer: Author, Acknowledgment Status & Controls ─ */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-2.5 border-t border-slate-100 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>— {a.author_name}</span>

                      {/* Staff: View Acknowledged Count */}
                      {isStaff && isUrgentOrPinned && (
                        <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {a.acknowledged_count || 0} {t("acknowledged_count")}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Student: Acknowledgment Button / Badge for Urgent or Pinned */}
                    {!isStaff && isUrgentOrPinned && (
                      <div>
                        {a.has_acknowledged ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100 gap-1 text-[11px] font-medium h-6">
                            <Check className="h-3 w-3 text-emerald-700" />
                            <span>{t("acknowledged_badge")}</span>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAcknowledge(a.id)}
                            disabled={acknowledging === a.id}
                            className="h-7 text-xs gap-1.5 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100 font-medium"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-amber-700" />
                            <span>{t("acknowledge_btn")}</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Staff Action Controls: Edit, Pin/Unpin, Delete */}
                {isStaff && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(a)}
                      title={t("edit_announcement")}
                      data-testid={`edit-ann-${a.id}`}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => togglePin(a)}
                      title={a.pinned ? t("unpin") : t("pin")}
                      data-testid={`pin-ann-${a.id}`}
                      className={
                        a.pinned
                          ? "text-primary hover:text-primary/80"
                          : "text-muted-foreground hover:text-primary"
                      }
                    >
                      <Pin className={`h-4 w-4 ${a.pinned ? "fill-primary" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive/80"
                      onClick={() => del(a.id)}
                      data-testid={`delete-ann-${a.id}`}
                      title={t("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
