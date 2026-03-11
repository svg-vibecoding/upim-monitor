import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  BarChart3,
  Layers,
  Settings2,
  Eye,
  Monitor,
  ShoppingCart,
  ChevronRight,
  AlertTriangle,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* ── Severity helpers ─────────────────────────────────────────── */

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

/* ── Report icon helper ───────────────────────────────────────── */
function reportIcon(name: string) {
  switch (name) {
    case "PIM General": return <BarChart3 className="h-5 w-5 text-primary" />;
    case "SumaGO B2B": return <Monitor className="h-5 w-5 text-info" />;
    case "SumaGO B2C": return <Eye className="h-5 w-5 text-success" />;
    case "Compras": return <ShoppingCart className="h-5 w-5 text-warning" />;
    default: return <FileText className="h-5 w-5 text-primary" />;
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

  // ── PIM General completeness ──
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

  // ── Focus points for selected report ──
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
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
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
            <Card>
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Estado General
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <p className="text-4xl font-bold text-foreground tabular-nums leading-none">
                  {kpis!.total.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">SKUs totales en sistema</p>
                {pimGeneralCompleteness !== null && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Progreso total</span>
                      <span className="font-semibold tabular-nums text-foreground">{pimGeneralCompleteness}%</span>
                    </div>
                    <CompletenessBar value={pimGeneralCompleteness} showLabel={false} size="sm" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── B) Estado Operativo ── */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Estado Operativo
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-3xl font-bold text-foreground tabular-nums leading-none">
                      {kpis!.active.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-success mt-1">Activos</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground tabular-nums leading-none">
                      {kpis!.inactive.toLocaleString()}
                    </p>
                    <p className="text-xs font-medium text-destructive mt-1">Inactivos</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Base Digital</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground tabular-nums">
                      {kpis!.digitalBase.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">{pctDigitalBase}% del total</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── C) Visibilidad Digital ── */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Visibilidad Digital
                  </span>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Eye className="h-4 w-4 text-primary" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                      <Monitor className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Visibles B2B</p>
                      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                        {kpis!.visibleB2B.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <ShoppingCart className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Visibles B2C</p>
                      <p className="text-2xl font-bold text-foreground tabular-nums leading-none">
                        {kpis!.visibleB2C.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ═══ REPORTS + FOCUS ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ── Informes Predefinidos ── */}
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <h2 className="text-base font-semibold text-foreground mb-4">
                  Informes Predefinidos
                </h2>
                <div className="space-y-2">
                  {reports &&
                    reports.map((r, idx) => (
                      <div
                        key={r.id}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors group"
                        onClick={() => navigate(`/informes/${r.id}`)}
                      >
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          {reportIcon(r.name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {idx + 1}. {r.name}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{r.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Focos de atención ── */}
            <Card>
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Focos de atención
                  </h2>
                  {/* Severity dots summary */}
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    {(["critical", "low", "medium", "acceptable"] as SeverityLevel[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSeverityFilter(severityFilter === s ? null : s)}
                        className={`h-3 w-3 rounded-full transition-all ${severityDot(s)} ${
                          severityFilter === s ? "ring-2 ring-offset-2 ring-foreground/30" : "opacity-60 hover:opacity-100"
                        }`}
                        title={severityLabel(s)}
                      />
                    ))}
                  </div>
                </div>

                {/* Report tabs */}
                <div className="flex border-b border-border mb-4">
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
                {filteredFocusItems.length > 0 ? (
                  <ScrollArea className="max-h-[360px]">
                    <div className="space-y-3 pr-2">
                      {filteredFocusItems.map((fp) => {
                        const severity = getSeverity(fp.completeness);
                        return (
                          <div key={fp.name} className="space-y-1.5">
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
                            <p className="text-[11px] text-muted-foreground tabular-nums">
                              {fp.populated.toLocaleString()} de {fp.totalSKUs.toLocaleString()} SKUs
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    {focusItems.length > 0
                      ? "No hay atributos en este rango de severidad."
                      : "Sin datos suficientes para calcular focos."}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
