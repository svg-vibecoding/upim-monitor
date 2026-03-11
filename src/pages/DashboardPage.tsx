import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  usePimKPIs,
  usePimRecords,
  usePredefinedReports,
  useAttributeOrder,
  getEvaluableAttributes,
  filterRealAttributes,
  getRecordsForReport,
  computeAttributeResults,
  getFullAttributeList,
} from "@/hooks/usePimData";
import type { PredefinedReport } from "@/data/mockData";
import {
  PlusCircle,
  FileText,
  Package,
  Activity,
  Globe,
  AlertTriangle,
  TrendingDown,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ── Traffic-light severity helpers ─────────────────────────────── */

type SeverityLevel = "critical" | "low" | "medium" | "acceptable";

function getSeverity(pct: number): SeverityLevel {
  if (pct <= 10) return "critical";
  if (pct <= 25) return "low";
  if (pct <= 50) return "medium";
  return "acceptable";
}

function severityLabel(s: SeverityLevel) {
  switch (s) {
    case "critical": return "0–10 %";
    case "low": return "10–25 %";
    case "medium": return "25–50 %";
    case "acceptable": return "50 %+";
  }
}

function severityColor(s: SeverityLevel) {
  switch (s) {
    case "critical": return "bg-destructive text-destructive-foreground";
    case "low": return "bg-warning text-warning-foreground";
    case "medium": return "bg-info text-info-foreground";
    case "acceptable": return "bg-success text-success-foreground";
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

/* ── Dashboard ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKPIs } = usePimKPIs();
  const { data: records, isLoading: loadingRecords } = usePimRecords();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: attributeOrder } = useAttributeOrder();

  const isLoading = loadingKPIs || loadingRecords || loadingReports;
  const hasData = kpis && kpis.total > 0;

  // ── Focus: report selector & severity filter ──
  const focusReports = useMemo(
    () => (reports || []).filter((r) =>
      ["PIM General", "SumaGO B2B", "SumaGO B2C", "Compras"].includes(r.name)
    ),
    [reports]
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const activeReport = focusReports.find((r) => r.id === selectedReportId) || focusReports[0] || null;

  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);

  // ── Compute PIM General completeness for hero card ──
  const pimGeneralCompleteness = useMemo(() => {
    if (!records || records.length === 0 || !reports || !attributeOrder) return null;
    const pimGeneral = reports.find((r) => r.name === "PIM General");
    if (!pimGeneral) return null;
    const universe = getRecordsForReport(records, pimGeneral);
    if (universe.length === 0) return null;
    const realAttrs = attributeOrder.length > 0
      ? filterRealAttributes(pimGeneral.attributes, getFullAttributeList(attributeOrder))
      : pimGeneral.attributes;
    const evaluable = getEvaluableAttributes(realAttrs);
    if (evaluable.length === 0) return null;
    const results = computeAttributeResults(universe, evaluable);
    const avg = Math.round(results.reduce((s, a) => s + a.completeness, 0) / results.length);
    return avg;
  }, [records, reports, attributeOrder]);

  // ── Compute focus points for selected report ──
  const focusItems = useMemo(() => {
    if (!activeReport || !records || records.length === 0 || !attributeOrder) return [];
    const universe = getRecordsForReport(records, activeReport);
    if (universe.length === 0) return [];
    const realAttrs = attributeOrder.length > 0
      ? filterRealAttributes(activeReport.attributes, getFullAttributeList(attributeOrder))
      : activeReport.attributes;
    const evaluable = getEvaluableAttributes(realAttrs);
    if (evaluable.length === 0) return [];
    return computeAttributeResults(universe, evaluable).sort((a, b) => a.completeness - b.completeness);
  }, [activeReport, records, attributeOrder]);

  const filteredFocusItems = severityFilter
    ? focusItems.filter((fp) => getSeverity(fp.completeness) === severityFilter)
    : focusItems;

  // ── Severity counts for filter badges ──
  const severityCounts = useMemo(() => {
    const counts: Record<SeverityLevel, number> = { critical: 0, low: 0, medium: 0, acceptable: 0 };
    focusItems.forEach((fp) => counts[getSeverity(fp.completeness)]++);
    return counts;
  }, [focusItems]);

  // ── Formatted date ──
  const lastUpdateFormatted = kpis?.lastUpdated
    ? format(new Date(kpis.lastUpdated), "d 'de' MMMM yyyy, HH:mm", { locale: es })
    : "Sin datos cargados";

  // ── Percentages ──
  const pctActive = kpis && kpis.total > 0 ? Math.round((kpis.active / kpis.total) * 100) : 0;
  const pctInactive = kpis && kpis.total > 0 ? Math.round((kpis.inactive / kpis.total) * 100) : 0;
  const pctDigitalBase = kpis && kpis.total > 0 ? Math.round((kpis.digitalBase / kpis.total) * 100) : 0;
  const pctVisB2B = kpis && kpis.digitalBase > 0 ? Math.round((kpis.visibleB2B / kpis.digitalBase) * 100) : 0;
  const pctVisB2C = kpis && kpis.digitalBase > 0 ? Math.round((kpis.visibleB2C / kpis.digitalBase) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inicio</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Última actualización: {lastUpdateFormatted}
          </p>
        </div>
        <Button onClick={() => navigate("/nuevo-informe")} className="gap-2">
          <PlusCircle className="h-4 w-4" /> Crear nuevo informe
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
          <Skeleton className="h-80 w-full" />
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ── A) Estado General ── */}
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Estado General
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-3xl font-bold text-foreground tabular-nums">
                    {kpis!.total.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground">SKUs totales</span>
                </div>
                {pimGeneralCompleteness !== null && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Completitud PIM General</span>
                      <span className="font-semibold tabular-nums">{pimGeneralCompleteness}%</span>
                    </div>
                    <CompletenessBar value={pimGeneralCompleteness} showLabel={false} size="sm" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── B) Estado Operativo ── */}
            <Card className="border-l-4 border-l-success">
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-success" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Estado Operativo
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.active.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Activos</p>
                    <p className="text-xs font-medium text-success tabular-nums">{pctActive}% del total</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.inactive.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Inactivos</p>
                    <p className="text-xs font-medium text-muted-foreground tabular-nums">{pctInactive}%</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.digitalBase.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Base Digital</p>
                    <p className="text-xs font-medium text-info tabular-nums">{pctDigitalBase}% del total</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── C) Visibilidad Digital ── */}
            <Card className="border-l-4 border-l-info">
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="h-4 w-4 text-info" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Visibilidad Digital
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.visibleB2B.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Visibles B2B</p>
                    <p className="text-xs font-medium text-info tabular-nums">
                      {pctVisB2B}% de Base Digital
                    </p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.visibleB2C.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Visibles B2C</p>
                    <p className="text-xs font-medium text-info tabular-nums">
                      {pctVisB2C}% de Base Digital
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ REPORTS + FOCUS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* ── Predefined Reports (compact, 2-col) ── */}
            <div className="lg:col-span-2">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Informes predefinidos
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                {reports &&
                  reports.map((r) => (
                    <Card
                      key={r.id}
                      className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                      onClick={() => navigate(`/informes/${r.id}`)}
                    >
                      <CardContent className="py-3 px-4 flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>

            {/* ── Focus Points (enhanced) ── */}
            <div className="lg:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-destructive" />
                  Focos de atención
                </h2>
              </div>

              <Card>
                <CardContent className="pt-4 pb-3 px-4 space-y-3">
                  {/* Report selector tabs */}
                  <div className="flex flex-wrap gap-1.5">
                    {focusReports.map((r) => (
                      <Button
                        key={r.id}
                        variant={activeReport?.id === r.id ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-3"
                        onClick={() => {
                          setSelectedReportId(r.id);
                          setSeverityFilter(null);
                        }}
                      >
                        {r.name}
                      </Button>
                    ))}
                  </div>

                  {/* Severity filter chips */}
                  {focusItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Filter className="h-3 w-3 text-muted-foreground" />
                      {(["critical", "low", "medium", "acceptable"] as SeverityLevel[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                          className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                            severityFilter === s
                              ? severityColor(s) + " border-transparent font-medium"
                              : "border-border text-muted-foreground hover:border-foreground/20"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${severityDot(s)}`} />
                          {severityLabel(s)}
                          <span className="font-semibold tabular-nums">{severityCounts[s]}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Universe info */}
                  {activeReport && (
                    <p className="text-xs text-muted-foreground">
                      Universo: <span className="font-medium text-foreground">{activeReport.universe}</span>
                      {focusItems.length > 0 && (
                        <>
                          {" · "}
                          <span className="tabular-nums">{filteredFocusItems.length}</span> atributos
                          {severityFilter && " en este filtro"}
                        </>
                      )}
                    </p>
                  )}

                  {/* Attribute list */}
                  {filteredFocusItems.length > 0 ? (
                    <ScrollArea className="max-h-[340px]">
                      <div className="space-y-1 pr-3">
                        {filteredFocusItems.map((fp) => {
                          const severity = getSeverity(fp.completeness);
                          return (
                            <div
                              key={fp.name}
                              className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                            >
                              {/* Severity dot */}
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${severityDot(severity)}`} />

                              {/* Attribute name */}
                              <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                                {fp.name}
                              </span>

                              {/* Counts */}
                              <span className="text-xs text-muted-foreground tabular-nums shrink-0 whitespace-nowrap">
                                {fp.populated.toLocaleString()} / {fp.totalSKUs.toLocaleString()}
                              </span>

                              {/* Progress bar */}
                              <div className="w-20 shrink-0">
                                <CompletenessBar value={fp.completeness} showLabel={false} size="sm" />
                              </div>

                              {/* Percentage */}
                              <span className="text-xs font-semibold tabular-nums w-10 text-right shrink-0">
                                {fp.completeness}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      {focusItems.length > 0
                        ? "No hay atributos en este rango de severidad."
                        : "Sin datos suficientes para calcular focos."}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
