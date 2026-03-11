import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  usePimKPIs,
  usePredefinedReports,
  useReportCompleteness,
  sortReportsByDisplayOrder,
  NON_EVALUABLE_FIELDS,
} from "@/hooks/usePimData";
import {
  PlusCircle,
  ChevronRight,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ── Severity helpers ─────────────────────────────────────────── */

type SeverityLevel = "critical" | "low" | "medium" | "acceptable";

function getSeverity(pct: number): SeverityLevel {
  if (pct <= 25) return "critical";
  if (pct <= 50) return "low";
  if (pct <= 75) return "medium";
  return "acceptable";
}

function severityLabel(s: SeverityLevel) {
  switch (s) {
    case "critical": return "0–25 %";
    case "low": return "25–50 %";
    case "medium": return "50–75 %";
    case "acceptable": return "75 %+";
  }
}

function severityDot(s: SeverityLevel) {
  switch (s) {
    case "critical": return "bg-destructive";
    case "low": return "bg-warning";
    case "medium": return "bg-info";
    case "acceptable": return "bg-success";
  }
}

function severityBarColor(s: SeverityLevel) {
  switch (s) {
    case "critical": return "hsl(var(--destructive))";
    case "low": return "hsl(var(--warning))";
    case "medium": return "hsl(var(--info))";
    case "acceptable": return "hsl(var(--success))";
  }
}

/* ── Dashboard ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKPIs } = usePimKPIs();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();

  const isLoading = loadingKPIs || loadingReports;
  const hasData = kpis && kpis.total > 0;

  const focusReports = useMemo(
    () => sortReportsByDisplayOrder((reports || []).filter((r) => ["PIM General", "SumaGO B2B", "SumaGO B2C", "Compras"].includes(r.name))),
    [reports]
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const activeReport = focusReports.find((r) => r.id === selectedReportId) || focusReports[0] || null;
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);

  // Server-side completeness for active report tab
  const { data: rawFocusItems, isLoading: loadingFocus } = useReportCompleteness(activeReport?.id);

  // Server-side completeness for PIM General
  const pimGeneralReport = useMemo(() => reports?.find((r) => r.name === "PIM General"), [reports]);
  const { data: pimGeneralItems } = useReportCompleteness(pimGeneralReport?.id);

  const pimGeneralCompleteness = useMemo(() => {
    if (!pimGeneralItems || pimGeneralItems.length === 0) return null;
    const evaluable = pimGeneralItems.filter((a) => !NON_EVALUABLE_FIELDS.includes(a.name));
    if (evaluable.length === 0) return null;
    return Math.round(evaluable.reduce((s, a) => s + a.completeness, 0) / evaluable.length);
  }, [pimGeneralItems]);

  const focusItems = useMemo(() => {
    if (!rawFocusItems) return [];
    return rawFocusItems
      .filter((a) => !NON_EVALUABLE_FIELDS.includes(a.name))
      .sort((a, b) => a.completeness - b.completeness);
  }, [rawFocusItems]);

  const filteredFocusItems = severityFilter
    ? focusItems.filter((fp) => getSeverity(fp.completeness) === severityFilter)
    : focusItems;

  const severityCounts = useMemo(() => {
    const counts: Record<SeverityLevel, number> = { critical: 0, low: 0, medium: 0, acceptable: 0 };
    focusItems.forEach((fp) => counts[getSeverity(fp.completeness)]++);
    return counts;
  }, [focusItems]);

  const lastUpdateFormatted = kpis?.lastUpdated
    ? format(new Date(kpis.lastUpdated), "d 'de' MMMM yyyy, HH:mm", { locale: es })
    : "Sin datos cargados";

  const pctDigitalBase = kpis && kpis.total > 0 ? Math.round((kpis.digitalBase / kpis.total) * 100) : 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Última actualización: {lastUpdateFormatted}
          </p>
        </div>
        <Button onClick={() => navigate("/nuevo-informe")} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Crear nuevo informe
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !hasData ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            <p className="text-sm">
              No hay datos PIM cargados. Ve a <strong>Administración → Base PIM</strong> para cargar tu archivo Excel.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ═══ KPI CARDS ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* A) Catálogo */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    Catálogo
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">/</span>
                  <span className="text-[10px] text-muted-foreground">SKUs totales</span>
                </div>
                <p className="text-5xl font-bold text-foreground tabular-nums leading-none mt-3">
                  {kpis!.total.toLocaleString()}
                </p>
                <div className="flex-1 min-h-6" />
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {kpis!.active.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {Math.round((kpis!.active / kpis!.total) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <p className="text-[10px] text-muted-foreground">Activos</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {kpis!.inactive.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {Math.round((kpis!.inactive / kpis!.total) * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <p className="text-[10px] text-muted-foreground">Inactivos</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B) Base Digital */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    Base Digital
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">/</span>
                  <span className="text-[10px] text-muted-foreground">SKUs con Código SumaGo</span>
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <p className="text-5xl font-bold text-foreground tabular-nums leading-none">
                    {kpis!.digitalBase.toLocaleString()}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">{pctDigitalBase}% del total</span>
                </div>
                <div className="flex-1 min-h-6" />
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {kpis!.visibleB2B.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {kpis!.digitalBase > 0 ? Math.round((kpis!.visibleB2B / kpis!.digitalBase) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-info shrink-0" />
                      <p className="text-[10px] text-muted-foreground">Visibles B2B</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {kpis!.visibleB2C.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {kpis!.digitalBase > 0 ? Math.round((kpis!.visibleB2C / kpis!.digitalBase) * 100) : 0}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-info shrink-0" />
                      <p className="text-[10px] text-muted-foreground">Visibles B2C</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C) Completitud General */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    Completitud General
                  </span>
                </div>
                {pimGeneralCompleteness !== null ? (
                  <>
                    <p className="text-5xl font-bold text-foreground tabular-nums leading-none mt-3">
                      {pimGeneralCompleteness}%
                    </p>
                    <div className="flex-1 min-h-6" />
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Progreso PIM General</p>
                      <CompletenessBar value={pimGeneralCompleteness} showLabel={false} size="sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-bold text-muted-foreground/30 tabular-nums leading-none mt-3">—</p>
                    <div className="flex-1 min-h-6" />
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">Sin datos de completitud</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ═══ FOCOS + REPORTS (asymmetric) ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
            {/* ── Focos de atención (wider, left) ── */}
            <div className="lg:col-span-2 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Focos de atención
                </h2>
                <div className="flex items-center gap-2">
                  <Filter className="h-3 w-3 text-muted-foreground/50" />
                  {(["critical", "low", "medium", "acceptable"] as SeverityLevel[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                      className={`flex items-center gap-1 transition-all ${
                        severityFilter === s ? "opacity-100" : "opacity-50 hover:opacity-80"
                      }`}
                      title={severityLabel(s)}
                    >
                      <span className={`h-2.5 w-2.5 rounded-full ${severityDot(s)} ${
                        severityFilter === s ? "ring-2 ring-offset-1 ring-foreground/20" : ""
                      }`} />
                      <span className="text-[10px] tabular-nums text-muted-foreground font-medium">
                          {severityCounts[s]}
                        </span>
                    </button>
                  ))}
                </div>
              </div>
              <Card className="h-full flex flex-col">
                <CardContent className="pt-4 pb-4 px-4 flex flex-col flex-1 overflow-hidden">
                  {/* Report tabs */}
                  <div className="flex border-b border-border mb-4 shrink-0">
                    {focusReports.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedReportId(r.id);
                          setSeverityFilter(null);
                        }}
                        className={`px-3 py-2 text-xs font-medium transition-all border-b-2 -mb-px ${
                          activeReport?.id === r.id
                            ? "border-primary text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {r.name}
                      </button>
                    ))}
                  </div>

                  {/* Focus list */}
                  {loadingFocus ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      Informe en proceso…
                    </p>
                  ) : filteredFocusItems.length > 0 ? (
                    <ScrollArea className="flex-1">
                      <div className="space-y-3 pr-2">
                        {filteredFocusItems.map((fp) => {
                          const severity = getSeverity(fp.completeness);
                          return (
                            <div key={fp.name} className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-foreground truncate pr-3">
                                  {fp.name}
                                </span>
                                <span
                                  className="text-sm font-bold tabular-nums shrink-0"
                                  style={{ color: severityBarColor(severity) }}
                                >
                                  {fp.completeness}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${Math.max(fp.completeness, 2)}%`,
                                    backgroundColor: severityBarColor(severity),
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-muted-foreground py-6 text-center">
                      {focusItems.length > 0
                        ? "No hay atributos en este rango de severidad."
                        : "Sin datos de completitud para este informe."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Informes Predefinidos (narrower, right) ── */}
            <div className="lg:col-span-1 flex flex-col">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Informes Predefinidos
              </h2>
              <Card className="h-full">
                <CardContent className="py-1.5 px-1.5">
                  {reports &&
                    sortReportsByDisplayOrder(reports).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/informes/${r.id}`)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>
                        </div>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
