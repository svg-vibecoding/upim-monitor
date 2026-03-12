import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Activity, LogIn, Users, FileText, Download, PlusCircle, Eye } from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

type TimeRange = "7d" | "30d" | "all";

interface UsageEvent {
  id: string;
  event_type: string;
  user_id: string;
  user_email: string;
  user_role: string;
  report_id: string | null;
  report_name: string | null;
  report_type: string | null;
  source_type: string | null;
  created_at: string;
}

/* ── Data hook ─────────────────────────────────────── */

function useUsageEvents(range: TimeRange) {
  return useQuery({
    queryKey: ["usage_events", range],
    queryFn: async () => {
      let query = supabase
        .from("usage_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (range !== "all") {
        const days = range === "7d" ? 7 : 30;
        const since = new Date();
        since.setDate(since.getDate() - days);
        query = query.gte("created_at", since.toISOString());
      }

      // Fetch up to 5000 events for analytics
      const { data, error } = await query.limit(5000);
      if (error) throw error;
      return (data || []) as UsageEvent[];
    },
  });
}

/* ── Page ──────────────────────────────────────────── */

export default function InsightsPage() {
  const [range, setRange] = useState<TimeRange>("30d");
  const { data: events = [], isLoading } = useUsageEvents(range);

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const logins = events.filter((e) => e.event_type === "login_success");
    const views = events.filter((e) => e.event_type === "report_viewed");
    const created = events.filter((e) => e.event_type === "report_created");
    const downloads = events.filter((e) => e.event_type === "report_downloaded");

    const uniqueUsers = new Set(events.map((e) => e.user_id)).size;
    const avgSessions = uniqueUsers > 0 ? (logins.length / uniqueUsers).toFixed(1) : "0";

    // Most viewed predefined report
    const viewCounts: Record<string, { name: string; count: number }> = {};
    views
      .filter((e) => e.report_type === "predefined" && e.report_name)
      .forEach((e) => {
        const key = e.report_name!;
        if (!viewCounts[key]) viewCounts[key] = { name: key, count: 0 };
        viewCounts[key].count++;
      });
    const topReport = Object.values(viewCounts).sort((a, b) => b.count - a.count)[0] || null;

    return {
      activeUsers: uniqueUsers,
      totalLogins: logins.length,
      avgSessions,
      totalViews: views.length,
      totalCreated: created.length,
      totalDownloads: downloads.length,
      topReport,
    };
  }, [events]);

  /* ── User table ── */
  const userRows = useMemo(() => {
    const map: Record<string, {
      name: string; email: string; role: string;
      lastLogin: string; logins: number; views: number; created: number; downloads: number;
    }> = {};

    events.forEach((e) => {
      if (!map[e.user_id]) {
        map[e.user_id] = {
          name: e.user_email.split("@")[0],
          email: e.user_email,
          role: e.user_role === "usuario_pro" ? "UsuarioPRO" : "PIM Manager",
          lastLogin: "",
          logins: 0, views: 0, created: 0, downloads: 0,
        };
      }
      const u = map[e.user_id];
      switch (e.event_type) {
        case "login_success":
          u.logins++;
          if (!u.lastLogin || e.created_at > u.lastLogin) u.lastLogin = e.created_at;
          break;
        case "report_viewed": u.views++; break;
        case "report_created": u.created++; break;
        case "report_downloaded": u.downloads++; break;
      }
    });

    return Object.values(map).sort((a, b) => (b.lastLogin || "").localeCompare(a.lastLogin || ""));
  }, [events]);

  /* ── Report table ── */
  const reportRows = useMemo(() => {
    const map: Record<string, {
      name: string; type: string;
      views: number; downloads: number; lastViewed: string;
    }> = {};

    events
      .filter((e) => (e.event_type === "report_viewed" || e.event_type === "report_downloaded") && e.report_name)
      .forEach((e) => {
        const key = `${e.report_name}_${e.report_type}`;
        if (!map[key]) {
          map[key] = {
            name: e.report_name!,
            type: e.report_type === "predefined" ? "Predefinido" : "Personalizado",
            views: 0, downloads: 0, lastViewed: "",
          };
        }
        const r = map[key];
        if (e.event_type === "report_viewed") {
          r.views++;
          if (!r.lastViewed || e.created_at > r.lastViewed) r.lastViewed = e.created_at;
        }
        if (e.event_type === "report_downloaded") r.downloads++;
      });

    return Object.values(map).sort((a, b) => b.views - a.views);
  }, [events]);

  const fmtDate = (d: string) => {
    if (!d) return "—";
    try { return format(new Date(d), "d MMM yyyy, HH:mm", { locale: es }); }
    catch { return "—"; }
  };

  const ranges: { value: TimeRange; label: string }[] = [
    { value: "7d", label: "7 días" },
    { value: "30d", label: "30 días" },
    { value: "all", label: "Histórico" },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights de uso</h1>
          <p className="text-xs text-muted-foreground mt-1">Analítica básica de adopción y consumo de la plataforma</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          {ranges.map((r) => (
            <Button
              key={r.value}
              variant={range === r.value ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7 px-3"
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-64" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={Users} label="Usuarios activos" value={kpis.activeUsers} />
            <KPICard icon={LogIn} label="Inicios de sesión" value={kpis.totalLogins} />
            <KPICard icon={Activity} label="Sesiones / usuario" value={kpis.avgSessions} />
            <KPICard icon={Eye} label="Consultas de informes" value={kpis.totalViews} />
            <KPICard icon={PlusCircle} label="Informes creados" value={kpis.totalCreated} />
            <KPICard icon={Download} label="Descargas" value={kpis.totalDownloads} />
            <Card className="col-span-2 md:col-span-2">
              <CardContent className="pt-4 pb-4 px-4">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Informe más consultado</p>
                {kpis.topReport ? (
                  <div className="flex items-baseline gap-2">
                    <p className="text-lg font-bold text-foreground truncate">{kpis.topReport.name}</p>
                    <span className="text-xs text-muted-foreground tabular-nums">{kpis.topReport.count} consultas</span>
                  </div>
                ) : (
                  <p className="text-lg font-bold text-muted-foreground/40">—</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* User usage table */}
          <Card>
            <CardContent className="pt-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Uso por usuario</h2>
              {userRows.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Correo</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead className="text-right">Último ingreso</TableHead>
                        <TableHead className="text-right w-20">Ingresos</TableHead>
                        <TableHead className="text-right w-24">Consultados</TableHead>
                        <TableHead className="text-right w-20">Creados</TableHead>
                        <TableHead className="text-right w-24">Descargas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRows.map((u) => (
                        <TableRow key={u.email}>
                          <TableCell className="font-medium text-sm">{u.email}</TableCell>
                          <TableCell>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                              {u.role}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(u.lastLogin)}</TableCell>
                          <TableCell className="text-right tabular-nums">{u.logins}</TableCell>
                          <TableCell className="text-right tabular-nums">{u.views}</TableCell>
                          <TableCell className="text-right tabular-nums">{u.created}</TableCell>
                          <TableCell className="text-right tabular-nums">{u.downloads}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay actividad registrada en este período.</p>
              )}
            </CardContent>
          </Card>

          {/* Report usage table */}
          <Card>
            <CardContent className="pt-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">Uso por informe</h2>
              {reportRows.length > 0 ? (
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Informe</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right w-24">Consultas</TableHead>
                        <TableHead className="text-right w-24">Descargas</TableHead>
                        <TableHead className="text-right">Última consulta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportRows.map((r) => (
                        <TableRow key={`${r.name}_${r.type}`}>
                          <TableCell className="font-medium text-sm">{r.name}</TableCell>
                          <TableCell>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              r.type === "Predefinido" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            }`}>
                              {r.type}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.views}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.downloads}</TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground">{fmtDate(r.lastViewed)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">No hay actividad registrada en este período.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

/* ── KPI Card component ─────────────────────────────── */

function KPICard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
