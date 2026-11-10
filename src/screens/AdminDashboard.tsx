"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/context/I18nContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { type LucideIcon, Users, MessageSquareWarning, FileCheck2, AlertTriangle, CalendarClock, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { getCountryLabel } from "@/constants/countries";

const COLORS = ["#1D4ED8", "#0284C7", "#0891B2", "#4F46E5", "#7C3AED", "#059669", "#D97706"];

interface DashboardData { total_students: number; complaints: { pending: number; in_progress: number; resolved: number }; documents: { pending: number; completed: number }; permissions_pending: number; iqomah_expiring: { id: string; full_name: string; nationality: string; iqomah_number: string; iqomah_expiry: string; days_left: number }[]; nationalities: { nationality: string; count: number }[]; recent_permissions_pending: { id: string; user_name: string; permission_type: string; destination: string; start_date: string; created_at: string }[] }
function StatCard({ icon: Icon, label, value, sub, tone = "primary" }: { icon: LucideIcon; label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "primary" | "warning" | "success" | "info" }) {
  const bg = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700",
    success: "bg-emerald-100 text-emerald-700",
    info: "bg-sky-100 text-sky-700",
  }[tone];
  return (
    <Card className="p-5 border-slate-200 hover:-translate-y-0.5 hover:shadow-sm transition-transform">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
          <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</div>
          {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-lg ${bg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function AdminDashboard() {
  const { t, lang } = useI18n();
  const [error, setError] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    api.get("/dashboard/admin").then((r) => setData(r.data)).catch(() => setError(true));
  }, []);

  if (error) return <div role="alert" className="space-y-3"><p>Unable to load the dashboard. Check that the demo server is running.</p><Button onClick={() => window.location.reload()}>Retry</Button></div>;
  if (!data) return <div className="text-muted-foreground">Loading…</div>;

  const nationalityChartData = data.nationalities.map((n) => ({
    ...n,
    label: getCountryLabel(n.nationality, lang),
  }));

  const complaintData = [
    { name: t("pending"), value: data.complaints.pending },
    { name: t("in_progress"), value: data.complaints.in_progress },
    { name: t("resolved"), value: data.complaints.resolved },
  ];

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("dashboard")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("app_full")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={Users} label={t("total_students")} value={data.total_students} tone="primary" />
        <StatCard icon={MessageSquareWarning} label={t("pending_complaints")} value={data.complaints.pending} tone="warning" />
        <StatCard icon={FileCheck2} label={t("docs_processed")} value={data.documents.completed} sub={`${data.documents.pending} ${t("pending").toLowerCase()}`} tone="success" />
        <StatCard icon={AlertTriangle} label={t("iqomah_expiring")} value={data.iqomah_expiring.length} tone="info" />
        <StatCard icon={CalendarCheck} label={t("pending_permissions")} value={data.permissions_pending || 0} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2 border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{t("nationality_dist")}</h3>
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/15">{data.total_students}</Badge>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationalityChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="count" fill="#1D4ED8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">{t("complaint_overview")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={complaintData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {complaintData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="p-6 border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <CalendarClock className="h-5 w-5 text-amber-600" />
          <h3 className="text-lg font-semibold text-slate-900">{t("iqomah_expiring")}</h3>
        </div>
        {data.iqomah_expiring.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t("no_data")}</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-start px-4 py-2.5 font-medium">{t("full_name")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("nationality")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("iqomah_number")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("iqomah_expiry")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("days_left")}</th>
                </tr>
              </thead>
              <tbody>
                {data.iqomah_expiring.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100" data-testid={`expiring-row-${s.id}`}>
                    <td className="px-4 py-2.5 font-medium">{s.full_name}</td>
                    <td className="px-4 py-2.5">{getCountryLabel(s.nationality, lang)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.iqomah_number}</td>
                    <td className="px-4 py-2.5 tabular-nums">{s.iqomah_expiry}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={
                        s.days_left < 0 ? "bg-red-100 text-red-800 hover:bg-red-100" :
                        s.days_left <= 14 ? "bg-amber-100 text-amber-800 hover:bg-amber-100" :
                        "bg-slate-100 text-slate-700 hover:bg-slate-100"
                      }>
                        {s.days_left} {t("days_left")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-6 border-slate-200" data-testid="recent-permissions-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-slate-900">{t("recent_permission_requests")}</h3>
            {data.permissions_pending > 0 && (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 tabular-nums">{data.permissions_pending}</Badge>
            )}
          </div>
          <Link href="/permissions">
            <Button variant="outline" size="sm" data-testid="dash-review-perm-btn">{t("review")}</Button>
          </Link>
        </div>
        {(!data.recent_permissions_pending || data.recent_permissions_pending.length === 0) ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t("no_data")}</div>
        ) : (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-start px-4 py-2.5 font-medium">{t("student")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("permission_type")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("destination")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("start_date")}</th>
                  <th className="text-start px-4 py-2.5 font-medium">{t("created_at")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_permissions_pending.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100" data-testid={`dash-perm-${p.id}`}>
                    <td className="px-4 py-2.5 font-medium">{p.user_name}</td>
                    <td className="px-4 py-2.5">{t(p.permission_type)}</td>
                    <td className="px-4 py-2.5">{p.destination}</td>
                    <td className="px-4 py-2.5 tabular-nums">{p.start_date}</td>
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
