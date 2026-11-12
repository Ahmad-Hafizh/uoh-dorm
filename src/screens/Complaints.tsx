"use client";

import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { api, formatApiError } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Plus, MessageSquareWarning, Search, Layers, CheckCircle2, Clock, MapPin,
  Paperclip, Send, Lock, UserCheck, AlertTriangle, Flame, Trash2, Pencil,
  LayoutGrid, List, MessageSquare, ExternalLink, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import { FileViewButton } from "@/components/FilePreview";

export type ComplaintStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";
export type ComplaintPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ComplaintCategory {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
}

export interface ComplaintMessage {
  id: string;
  complaint_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  attachments?: string[] | null;
  is_internal_note: boolean;
  created_at: string;
}

export interface Complaint {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  location_details?: string | null;
  attachments?: string[] | null;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  category_id: string;
  category_name?: string;
  student_id: string;
  student_name: string;
  student_email?: string;
  assigned_to_id?: string | null;
  assigned_to_name?: string | null;
  created_at: string;
  updated_at?: string | null;
  messages_count?: number;
  messages?: ComplaintMessage[];
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

function PriorityBadge({ priority, t }: { priority?: ComplaintPriority | string; t: (k: string) => string }) {
  const p = (priority || "MEDIUM").toUpperCase();
  if (p === "URGENT") {
    return (
      <Badge className="bg-rose-100 text-rose-800 border border-rose-300 font-semibold gap-1 hover:bg-rose-100 shadow-xs animate-pulse">
        <Flame className="h-3 w-3 text-rose-600" />
        {t("priority_urgent")}
      </Badge>
    );
  }
  if (p === "HIGH") {
    return (
      <Badge className="bg-orange-100 text-orange-800 border border-orange-300 font-medium gap-1 hover:bg-orange-100">
        <AlertTriangle className="h-3 w-3 text-orange-600" />
        {t("priority_high")}
      </Badge>
    );
  }
  if (p === "LOW") {
    return (
      <Badge className="bg-slate-100 text-slate-700 border border-slate-200 gap-1 hover:bg-slate-100">
        {t("priority_low")}
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 gap-1 hover:bg-blue-50">
      {t("priority_medium")}
    </Badge>
  );
}

function StatusBadge({ status, t }: { status?: ComplaintStatus | string; t: (k: string) => string }) {
  const s = (status || "PENDING").toUpperCase();
  const map: Record<string, { cls: string; label: string }> = {
    PENDING: { cls: "bg-amber-100 text-amber-800 border-amber-200", label: t("status_pending") },
    ASSIGNED: { cls: "bg-purple-100 text-purple-800 border-purple-200", label: t("status_assigned") },
    IN_PROGRESS: { cls: "bg-sky-100 text-sky-800 border-sky-200", label: t("status_in_progress") },
    RESOLVED: { cls: "bg-emerald-100 text-emerald-800 border-emerald-200", label: t("status_resolved") },
    REJECTED: { cls: "bg-red-100 text-red-800 border-red-200", label: t("status_rejected") },
  };
  const current = map[s] || map.PENDING;
  return <Badge className={`${current.cls} border hover:opacity-90`}>{current.label}</Badge>;
}

export default function Complaints() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");
  const isAdmin = !!user && user.role === "admin";

  // Data states
  const [rows, setRows] = useState<Complaint[]>([]);
  const [categories, setCategories] = useState<ComplaintCategory[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Views
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Modals
  const [openNew, setOpenNew] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Complaint | null>(null);
  const [openCategoriesModal, setOpenCategoriesModal] = useState(false);

  // New ticket form
  const [form, setForm] = useState<{
    category_id: string;
    title: string;
    description: string;
    location_details: string;
    priority: ComplaintPriority;
    attachments: string[];
  }>({
    category_id: "",
    title: "",
    description: "",
    location_details: "",
    priority: "MEDIUM",
    attachments: [],
  });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: cData }, { data: catData }] = await Promise.all([
        api.get("/complaints"),
        api.get("/complaint-categories").catch(() => ({ data: [] })),
      ]);
      setRows(cData);
      setCategories(catData || []);

      if (isStaff) {
        api.get("/staff").then((r) => setStaffList(r.data || [])).catch(() => {});
      }
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Submit new ticket
  const submitTicket = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.category_id && categories.length > 0) {
      toast.error(lang === "ar" ? "يرجى اختيار تصنيف الشكوى" : "Please select a category");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/complaints", form);
      toast.success(t("ticket_submitted"));
      setOpenNew(false);
      setForm({
        category_id: categories[0]?.id || "",
        title: "",
        description: "",
        location_details: "",
        priority: "MEDIUM",
        attachments: [],
      });
      load();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSubmitting(false);
    }
  };

  // Filter complaints
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
      if (categoryFilter !== "ALL" && r.category_id !== categoryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (r.title || "").toLowerCase().includes(q);
        const matchNumber = (r.ticket_number || "").toLowerCase().includes(q);
        const matchLoc = (r.location_details || "").toLowerCase().includes(q);
        const matchStudent = (r.student_name || "").toLowerCase().includes(q);
        if (!matchTitle && !matchNumber && !matchLoc && !matchStudent) return false;
      }
      return true;
    });
  }, [rows, statusFilter, priorityFilter, categoryFilter, search]);

  const openTicketDetail = async (ticket: Complaint) => {
    try {
      const { data } = await api.get(`/complaints/${ticket.id}`);
      setSelectedTicket(data);
    } catch {
      setSelectedTicket(ticket);
    }
  };

  const refreshCurrentTicket = async (id: string) => {
    try {
      const { data } = await api.get(`/complaints/${id}`);
      setSelectedTicket(data);
      load();
    } catch {}
  };

  return (
    <div className="space-y-6" data-testid="complaints-page">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("complaints")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {rows.length} {t("tickets").toLowerCase()}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => setOpenCategoriesModal(true)}
              className="gap-2"
              data-testid="manage-categories-btn"
            >
              <Layers className="h-4 w-4 text-primary" />
              {t("manage_categories")}
            </Button>
          )}

          <Button
            onClick={() => {
              setForm({
                category_id: categories.find((c) => c.is_active)?.id || categories[0]?.id || "",
                title: "",
                description: "",
                location_details: "",
                priority: "MEDIUM",
                attachments: [],
              });
              setOpenNew(true);
            }}
            className="gap-2"
            data-testid="new-complaint-btn"
          >
            <Plus className="h-4 w-4" />
            {t("new_ticket")}
          </Button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-4 border-slate-200 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={lang === "ar" ? "بحث برقم التذكرة، العنوان، الطالب..." : "Search ticket #, title, student..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9 text-xs"
            />
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="text-xs bg-white">
              <SelectValue placeholder={t("all_statuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("all_statuses")}</SelectItem>
              <SelectItem value="PENDING">{t("status_pending")}</SelectItem>
              <SelectItem value="ASSIGNED">{t("status_assigned")}</SelectItem>
              <SelectItem value="IN_PROGRESS">{t("status_in_progress")}</SelectItem>
              <SelectItem value="RESOLVED">{t("status_resolved")}</SelectItem>
              <SelectItem value="REJECTED">{t("status_rejected")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Priority Filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="text-xs bg-white">
              <SelectValue placeholder={t("all_priorities")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("all_priorities")}</SelectItem>
              <SelectItem value="URGENT">{t("priority_urgent")}</SelectItem>
              <SelectItem value="HIGH">{t("priority_high")}</SelectItem>
              <SelectItem value="MEDIUM">{t("priority_medium")}</SelectItem>
              <SelectItem value="LOW">{t("priority_low")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="text-xs bg-white">
              <SelectValue placeholder={t("all_categories")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("all_categories")}</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle for Staff/Admin */}
        {isStaff && (
          <div className="flex items-center justify-between border-t border-slate-100 pt-2.5">
            <span className="text-xs text-muted-foreground">
              {filteredRows.length} {t("tickets").toLowerCase()}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("table")}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <List className="h-3.5 w-3.5" />
                {lang === "ar" ? "جدول" : "Table"}
              </Button>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setViewMode("kanban")}
                className="h-7 text-xs px-2.5 gap-1.5"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {lang === "ar" ? "لوحة كانبان" : "Kanban"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Main Content Area */}
      {filteredRows.length === 0 ? (
        <Card className="p-12 border-slate-200 text-center text-muted-foreground border-dashed">
          <MessageSquareWarning className="h-8 w-8 mx-auto mb-2 opacity-50" />
          {t("no_tickets_found")}
        </Card>
      ) : isStaff && viewMode === "kanban" ? (
        /* Kanban Board View */
        <div className="grid gap-4 md:grid-cols-4 overflow-x-auto pb-4">
          {(["PENDING", "ASSIGNED", "IN_PROGRESS", "RESOLVED"] as ComplaintStatus[]).map((colStatus) => {
            const colTickets = filteredRows.filter((r) => r.status === colStatus);
            return (
              <div key={colStatus} className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/80 space-y-3 min-w-[260px]">
                <div className="flex items-center justify-between px-1">
                  <span className="font-semibold text-xs text-slate-800 flex items-center gap-1.5">
                    <StatusBadge status={colStatus} t={t} />
                  </span>
                  <span className="text-xs text-muted-foreground font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {colTickets.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pe-1">
                  {colTickets.map((ticket) => (
                    <Card
                      key={ticket.id}
                      onClick={() => openTicketDetail(ticket)}
                      className="p-3.5 hover:border-primary/40 hover:shadow-xs transition-all cursor-pointer bg-white"
                      data-testid={`kanban-card-${ticket.id}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-primary">
                          {ticket.ticket_number}
                        </span>
                        <PriorityBadge priority={ticket.priority} t={t} />
                      </div>
                      <h4 className="font-semibold text-xs text-slate-900 line-clamp-1">{ticket.title}</h4>
                      {ticket.location_details && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1 truncate">
                          <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                          <span>{ticket.location_details}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
                        <span className="truncate max-w-[120px] font-medium">{ticket.student_name}</span>
                        {(ticket.messages_count || 0) > 0 && (
                          <span className="flex items-center gap-1 text-primary">
                            <MessageSquare className="h-3 w-3" />
                            {ticket.messages_count}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                  {colTickets.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-lg bg-white/50">
                      {lang === "ar" ? "لا توجد تذاكر" : "No tickets"}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <Card className="border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50/80 border-b text-slate-600 font-semibold">
                <tr>
                  <th className="px-4 py-3 text-start w-32">{t("ticket_number")}</th>
                  <th className="px-4 py-3 text-start">{t("title")}</th>
                  <th className="px-4 py-3 text-start">{t("complaint_category")}</th>
                  <th className="px-4 py-3 text-start w-28">{t("priority")}</th>
                  <th className="px-4 py-3 text-start w-28">{t("status")}</th>
                  {isStaff && <th className="px-4 py-3 text-start">{lang === "ar" ? "الطالب" : "Student"}</th>}
                  {isStaff && <th className="px-4 py-3 text-start">{t("assigned_to")}</th>}
                  <th className="px-4 py-3 text-start w-28">{lang === "ar" ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3 text-end w-20">{lang === "ar" ? "الإجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => openTicketDetail(r)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    data-testid={`complaint-row-${r.id}`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-primary">
                      {r.ticket_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 leading-tight">{r.title}</div>
                      {r.location_details && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{r.location_details}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.category_name}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={r.priority} t={t} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} t={t} />
                    </td>
                    {isStaff && (
                      <td className="px-4 py-3 font-medium text-slate-800">{r.student_name}</td>
                    )}
                    {isStaff && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {r.assigned_to_name ? (
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <UserCheck className="h-3 w-3 text-indigo-600" />
                            {r.assigned_to_name}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">{t("unassigned")}</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">
                      {new Date(r.created_at).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", {
                        month: "numeric",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openTicketDetail(r);
                        }}
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {lang === "ar" ? "عرض" : "View"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New Ticket Modal */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-primary" />
              {t("new_ticket")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitTicket} className="space-y-4 pt-2" data-testid="complaint-form">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {t("complaint_category")} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.category_id}
                  onValueChange={(v) => setForm({ ...form, category_id: v })}
                >
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue placeholder={t("complaint_category")} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter((c) => (isStaff ? true : c.is_active))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">{t("priority")}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v as ComplaintPriority })}
                >
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">{t("priority_low")}</SelectItem>
                    <SelectItem value="MEDIUM">{t("priority_medium")}</SelectItem>
                    <SelectItem value="HIGH">{t("priority_high")}</SelectItem>
                    <SelectItem value="URGENT">{t("priority_urgent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("title")} <span className="text-destructive">*</span>
              </Label>
              <Input
                required
                placeholder={lang === "ar" ? "عنوان المشكلة بإيجاز..." : "Brief summary of the issue..."}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("location_details")}</Label>
              <Input
                placeholder={t("location_placeholder")}
                value={form.location_details}
                onChange={(e) => setForm({ ...form, location_details: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {t("description")} <span className="text-destructive">*</span>
              </Label>
              <Textarea
                required
                rows={4}
                placeholder={lang === "ar" ? "اشرح المشكلة بالتفصيل..." : "Describe the problem in detail..."}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Attachments */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{t("attachments")}</Label>
              <FileUpload
                kind="complaint"
                value={form.attachments[0] || null}
                onChange={(fileId) => setForm({ ...form, attachments: fileId ? [fileId] : [] })}
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpenNew(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={submitting} data-testid="complaint-submit">
                {submitting ? "…" : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail & Communication View Modal */}
      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          staffList={staffList}
          onClose={() => setSelectedTicket(null)}
          onRefresh={() => refreshCurrentTicket(selectedTicket.id)}
        />
      )}

      {/* Category Management Modal (Admin Only) */}
      {openCategoriesModal && (
        <CategoryManagerModal
          categories={categories}
          onClose={() => setOpenCategoriesModal(false)}
          onReload={load}
        />
      )}
    </div>
  );
}

/**
 * Ticket Detail View & 2-Way Helpdesk Chat
 */
function TicketDetailModal({
  ticket,
  staffList,
  onClose,
  onRefresh,
}: {
  ticket: Complaint;
  staffList: StaffUser[];
  onClose(): void;
  onRefresh(): void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const isStaff = !!user && (user.role === "admin" || user.role === "staff");

  const [message, setMessage] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Status & Assignment quick changes
  const [statusVal, setStatusVal] = useState<ComplaintStatus>(ticket.status);
  const [priorityVal, setPriorityVal] = useState<ComplaintPriority>(ticket.priority);
  const [assignedVal, setAssignedVal] = useState<string>(ticket.assigned_to_id || "UNASSIGNED");
  const [updatingTicket, setUpdatingTicket] = useState(false);

  const updateTicketMeta = async (patch: Partial<{ status: ComplaintStatus; priority: ComplaintPriority; assigned_to_id: string | null }>) => {
    setUpdatingTicket(true);
    try {
      await api.patch(`/complaints/${ticket.id}`, patch);
      toast.success(t("ticket_updated"));
      onRefresh();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setUpdatingTicket(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/complaints/${ticket.id}/messages`, {
        message: message.trim(),
        is_internal_note: isInternalNote,
        attachments: attachment ? [attachment] : [],
      });
      setMessage("");
      setAttachment(null);
      setIsInternalNote(false);
      toast.success(t("message_sent"));
      onRefresh();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    try {
      await api.patch(`/complaints/${ticket.id}`, { status: "RESOLVED" });
      toast.success(t("status_resolved") + " ✓");
      onRefresh();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono font-bold text-sm bg-primary/10 text-primary px-2.5 py-0.5 rounded-md">
                  {ticket.ticket_number}
                </span>
                <PriorityBadge priority={ticket.priority} t={t} />
                <StatusBadge status={ticket.status} t={t} />
              </div>
              <DialogTitle className="text-lg text-slate-900">{ticket.title}</DialogTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                <span>{ticket.category_name}</span>
                <span>·</span>
                <span>{new Date(ticket.created_at).toLocaleString()}</span>
                {ticket.location_details && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1 text-slate-700 font-medium">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {ticket.location_details}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Student Mark as Resolved Action */}
            {ticket.status !== "RESOLVED" && (
              <Button
                size="sm"
                onClick={markResolved}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                {t("mark_as_resolved")}
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Staff Controls (Status & Assignment) */}
        {isStaff && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">{t("status")}</Label>
              <Select
                value={statusVal}
                onValueChange={(v) => {
                  setStatusVal(v as ComplaintStatus);
                  updateTicketMeta({ status: v as ComplaintStatus });
                }}
                disabled={updatingTicket}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">{t("status_pending")}</SelectItem>
                  <SelectItem value="ASSIGNED">{t("status_assigned")}</SelectItem>
                  <SelectItem value="IN_PROGRESS">{t("status_in_progress")}</SelectItem>
                  <SelectItem value="RESOLVED">{t("status_resolved")}</SelectItem>
                  <SelectItem value="REJECTED">{t("status_rejected")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">{t("priority")}</Label>
              <Select
                value={priorityVal}
                onValueChange={(v) => {
                  setPriorityVal(v as ComplaintPriority);
                  updateTicketMeta({ priority: v as ComplaintPriority });
                }}
                disabled={updatingTicket}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">{t("priority_low")}</SelectItem>
                  <SelectItem value="MEDIUM">{t("priority_medium")}</SelectItem>
                  <SelectItem value="HIGH">{t("priority_high")}</SelectItem>
                  <SelectItem value="URGENT">{t("priority_urgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-slate-600">{t("assigned_to")}</Label>
              <Select
                value={assignedVal}
                onValueChange={(v) => {
                  setAssignedVal(v);
                  updateTicketMeta({ assigned_to_id: v === "UNASSIGNED" ? null : v });
                }}
                disabled={updatingTicket}
              >
                <SelectTrigger className="h-8 text-xs bg-white">
                  <SelectValue placeholder={t("unassigned")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNASSIGNED">{t("unassigned")}</SelectItem>
                  {staffList.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name} ({st.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Ticket Description and Details */}
        <div className="space-y-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2">
            <div className="text-xs font-semibold text-slate-700">
              {lang === "ar" ? "تفاصيل البلاغ:" : "Description:"}
            </div>
            <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {ticket.description}
            </p>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {t("attachments")}:
                </span>
                {ticket.attachments.map((fileId, i) => (
                  <FileViewButton
                    key={i}
                    fileId={fileId}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {lang === "ar" ? `مرفق ${i + 1}` : `Attachment ${i + 1}`}
                  </FileViewButton>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Threaded Messages History */}
        <div className="space-y-3 pt-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-primary" />
              {t("conversation_thread")}
            </h4>
            <Button variant="ghost" size="sm" onClick={onRefresh} className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-3 max-h-[35vh] overflow-y-auto pe-1">
            {(!ticket.messages || ticket.messages.length === 0) && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {lang === "ar" ? "لا توجد رسائل سابقة. يمكنك كتابة رد أدناه." : "No messages yet. Send a reply below."}
              </div>
            )}

            {ticket.messages?.map((msg) => {
              const isMine = Boolean(user && msg.sender_id === user.id);
              const isInternal = msg.is_internal_note;

              if (isInternal) {
                return (
                  <div
                    key={msg.id}
                    className="bg-amber-50/90 border border-amber-200 rounded-lg p-3 text-xs space-y-1.5"
                    data-testid={`internal-note-${msg.id}`}
                  >
                    <div className="flex items-center justify-between text-amber-800 font-semibold">
                      <span className="flex items-center gap-1">
                        <Lock className="h-3 w-3 text-amber-600" />
                        {t("internal_note_badge")} · {msg.sender_name}
                      </span>
                      <span className="text-[10px] text-amber-600 tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 text-xs space-y-1 ${
                      isMine
                        ? "bg-primary text-primary-foreground rounded-ee-xs"
                        : "bg-slate-100 text-slate-900 rounded-es-xs border border-slate-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] opacity-80 pb-0.5">
                      <span className="font-semibold">{msg.sender_name} ({msg.sender_role})</span>
                      <span className="tabular-nums">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.message}</p>

                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="pt-1.5 border-t border-white/20 flex items-center gap-2">
                        {msg.attachments.map((fileId, i) => (
                          <FileViewButton
                            key={i}
                            fileId={fileId}
                            className={`text-[11px] underline flex items-center gap-1 ${
                              isMine ? "text-white" : "text-primary"
                            }`}
                          >
                            <ExternalLink className="h-3 w-3" />
                            {lang === "ar" ? "مرفق" : "Attachment"}
                          </FileViewButton>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reply Form */}
          <form onSubmit={handleSendMessage} className="space-y-3 pt-2 border-t border-slate-100">
            <Textarea
              rows={2}
              placeholder={t("reply_placeholder")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="text-xs"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {/* File attachment */}
                <div className="max-w-[140px]">
                  <FileUpload
                    kind="complaint"
                    value={attachment}
                    onChange={(id) => setAttachment(id)}
                  />
                </div>

                {/* Staff Internal Note Switch */}
                {isStaff && (
                  <div className="flex items-center gap-1.5 ps-2 border-s border-slate-200">
                    <Switch
                      id="internal-note"
                      checked={isInternalNote}
                      onCheckedChange={setIsInternalNote}
                    />
                    <Label htmlFor="internal-note" className="text-xs cursor-pointer text-slate-700 font-medium">
                      {t("internal_note")}
                    </Label>
                  </div>
                )}
              </div>

              <Button type="submit" size="sm" disabled={sending || !message.trim()} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                {sending ? "…" : t("send_reply")}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Category Management Modal (Admin Only)
 */
function CategoryManagerModal({
  categories,
  onClose,
  onReload,
}: {
  categories: ComplaintCategory[];
  onClose(): void;
  onReload(): void;
}) {
  const { t, lang } = useI18n();
  const [editingCat, setEditingCat] = useState<ComplaintCategory | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setEditingCat(null);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const startEdit = (c: ComplaintCategory) => {
    setEditingCat(c);
    setName(c.name);
    setDescription(c.description || "");
    setIsActive(c.is_active);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingCat) {
        await api.patch(`/complaint-categories/${editingCat.id}`, {
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        });
      } else {
        await api.post("/complaint-categories", {
          name: name.trim(),
          description: description.trim() || null,
          is_active: isActive,
        });
      }
      toast.success(lang === "ar" ? "تم حفظ التصنيف" : "Category saved");
      startNew();
      onReload();
    } catch (e) {
      toast.error(formatApiError(axios.isAxiosError(e) ? e.response?.data?.detail : undefined));
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryActive = async (c: ComplaintCategory) => {
    try {
      await api.patch(`/complaint-categories/${c.id}`, { is_active: !c.is_active });
      onReload();
    } catch {}
  };

  const deleteCategory = async (id: string) => {
    if (!confirm(lang === "ar" ? "هل أنت متأكد من حذف هذا التصنيف؟" : "Delete this category?")) return;
    try {
      await api.delete(`/complaint-categories/${id}`);
      onReload();
    } catch {}
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            {t("manage_categories")}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Form */}
          <form onSubmit={handleSave} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="font-semibold text-xs text-slate-800">
              {editingCat ? t("edit_category") : t("add_category")}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">{t("category_name")}</Label>
                <Input
                  required
                  placeholder="مثال: التكييف والتهوية (HVAC)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("category_description")}</Label>
                <Input
                  placeholder="وصف مختصر لمجال الأعطال..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="text-xs bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="cat-active" className="text-xs cursor-pointer">{t("category_active")}</Label>
              </div>

              <div className="flex items-center gap-2">
                {editingCat && (
                  <Button type="button" variant="outline" size="sm" onClick={startNew}>
                    {t("cancel")}
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "…" : editingCat ? t("save") : t("add")}
                </Button>
              </div>
            </div>
          </form>

          {/* Categories List */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-xs text-start">
              <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                <tr>
                  <th className="px-3 py-2 text-start">{t("category_name")}</th>
                  <th className="px-3 py-2 text-start">{t("category_description")}</th>
                  <th className="px-3 py-2 text-center w-20">{t("category_active")}</th>
                  <th className="px-3 py-2 text-end w-20">{lang === "ar" ? "إجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{c.name}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.description || "—"}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Switch
                        checked={c.is_active}
                        onCheckedChange={() => toggleCategoryActive(c)}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-600"
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive"
                          onClick={() => deleteCategory(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
