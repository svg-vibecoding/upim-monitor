import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  usePimKPIs,
  usePredefinedReports,
  useReportCompleteness,
  useAttributeOrder,
  getFullAttributeList,
  getEvaluableAttributes,
  sortReportsByDisplayOrder,
  NON_EVALUABLE_FIELDS,
  useOperations,
  useOperationCount,
  useDashboardCardsConfig,
  type Card1Config,
  type Card2Config,
  type Card3Config,
  type CardColor,
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

/* ── Small helper: use operation count or null ── */
function useOpCount(opId: string | null | undefined) {
  return useOperationCount(opId || undefined);
}

/* ── Dashboard ──────────────────────────────────────────────────── */

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: kpis, isLoading: loadingKPIs } = usePimKPIs();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: attributeOrder } = useAttributeOrder();
  const { data: operations = [] } = useOperations();
  const { data: cardsConfig } = useDashboardCardsConfig();

  // Parse card configs with defaults
  const card1Cfg = useMemo(() => {
    const raw = cardsConfig?.find((c) => c.card_key === "card_1");
    const defaults: Card1Config = { main_value: "total", secondary_1: null, secondary_1_label: "Activos", secondary_2: null, secondary_2_label: "Inactivos" };
    return { label: raw?.label || "Catálogo", config: raw ? { ...defaults, ...(raw.config as Card1Config) } : defaults };
  }, [cardsConfig]);

  const card2Cfg = useMemo(() => {
    const raw = cardsConfig?.find((c) => c.card_key === "card_2");
    const defaults: Card2Config = { main_operation: null, secondary_1: null, secondary_1_label: "Visibles B2B", secondary_2: null, secondary_2_label: "Visibles B2C" };
    return { label: raw?.label || "Base Digital", config: raw ? { ...defaults, ...(raw.config as Card2Config) } : defaults };
  }, [cardsConfig]);

  const card3Cfg = useMemo(() => {
    const raw = cardsConfig?.find((c) => c.card_key === "card_3");
    const defaults: Card3Config = { report_id: null };
    return { label: raw?.label || "Completitud General", config: raw ? { ...defaults, ...(raw.config as Card3Config) } : defaults };
  }, [cardsConfig]);

  // Card 1 operation counts (skip fetch when value is "total")
  const c1MainIsOp = card1Cfg.config.main_value !== "total";
  const { data: c1MainOpCount } = useOpCount(c1MainIsOp ? card1Cfg.config.main_value : undefined);
  const c1Sec1IsTotal = card1Cfg.config.secondary_1 === "total";
  const { data: c1Sec1Count } = useOpCount(!c1Sec1IsTotal ? card1Cfg.config.secondary_1 : undefined);
  const c1Sec2IsTotal = card1Cfg.config.secondary_2 === "total";
  const { data: c1Sec2Count } = useOpCount(!c1Sec2IsTotal ? card1Cfg.config.secondary_2 : undefined);

  // Card 2 operation counts (skip fetch when value is "total")
  const c2MainIsTotal = card2Cfg.config.main_operation === "total";
  const { data: c2MainCount } = useOpCount(!c2MainIsTotal ? card2Cfg.config.main_operation : undefined);
  const c2Sec1IsTotal = card2Cfg.config.secondary_1 === "total";
  const { data: c2Sec1Count } = useOpCount(!c2Sec1IsTotal ? card2Cfg.config.secondary_1 : undefined);
  const c2Sec2IsTotal = card2Cfg.config.secondary_2 === "total";
  const { data: c2Sec2Count } = useOpCount(!c2Sec2IsTotal ? card2Cfg.config.secondary_2 : undefined);

  const totalEvaluableAttrs = useMemo(() => {
    if (!attributeOrder) return 0;
    return getEvaluableAttributes(getFullAttributeList(attributeOrder)).length;
  }, [attributeOrder]);

  const isLoading = loadingKPIs || loadingReports;
  const hasData = kpis && kpis.total > 0;

  const focusReports = useMemo(
    () => sortReportsByDisplayOrder((reports || []).filter((r) => ["PIM General", "Portafolio foco", "SumaGO B2B", "SumaGO B2C", "Operaciones"].includes(r.name))),
    [reports]
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const activeReport = focusReports.find((r) => r.id === selectedReportId) || focusReports[0] || null;
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);

  // Server-side completeness for active report tab
  const { data: rawFocusItems, isLoading: loadingFocus } = useReportCompleteness(activeReport?.id);

  // Card 3: report completeness
  const card3ReportId = card3Cfg.config.report_id;
  const pimGeneralReport = useMemo(() => reports?.find((r) => r.name === "PIM General"), [reports]);
  const completenessReportId = card3ReportId || pimGeneralReport?.id || null;
  const { data: completenessItems } = useReportCompleteness(completenessReportId);

  const completenessValue = useMemo(() => {
    if (!completenessItems || completenessItems.length === 0) return null;
    const evaluable = completenessItems.filter((a) => !NON_EVALUABLE_FIELDS.includes(a.name));
    if (evaluable.length === 0) return null;
    return Math.round(evaluable.reduce((s, a) => s + a.completeness, 0) / evaluable.length);
  }, [completenessItems]);

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

  // ── Card 1 computed values ──
  const total = kpis?.total ?? 0;
  const card1MainValue = c1MainIsOp ? (c1MainOpCount ?? 0) : total;
  const card1Sec1Value = c1Sec1IsTotal ? total : (card1Cfg.config.secondary_1 ? (c1Sec1Count ?? 0) : (kpis?.active ?? 0));
  const card1Sec2Value = c1Sec2IsTotal ? total : (card1Cfg.config.secondary_2 ? (c1Sec2Count ?? 0) : (kpis?.inactive ?? 0));
  const card1Sec1Pct = total > 0 ? Math.round((card1Sec1Value / total) * 100) : 0;
  const card1Sec2Pct = total > 0 ? Math.round((card1Sec2Value / total) * 100) : 0;

  // ── Card 2 computed values ──
  const card2MainValue = c2MainIsTotal ? total : (card2Cfg.config.main_operation ? (c2MainCount ?? 0) : (kpis?.digitalBase ?? 0));
  const card2Sec1Value = c2Sec1IsTotal ? total : (card2Cfg.config.secondary_1 ? (c2Sec1Count ?? 0) : (kpis?.visibleB2B ?? 0));
  const card2Sec2Value = c2Sec2IsTotal ? total : (card2Cfg.config.secondary_2 ? (c2Sec2Count ?? 0) : (kpis?.visibleB2C ?? 0));
  const card2MainPct = total > 0 ? Math.round((card2MainValue / total) * 100) : 0;
  const card2Sec1Pct = card2MainValue > 0 ? Math.round((card2Sec1Value / card2MainValue) * 100) : 0;
  const card2Sec2Pct = card2MainValue > 0 ? Math.round((card2Sec2Value / card2MainValue) * 100) : 0;

  // Card 3 label for progress bar subtitle
  const completenessReportName = card3ReportId
    ? reports?.find((r) => r.id === card3ReportId)?.name || "Informe seleccionado"
    : "PIM General";

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
            {/* A) Card 1 */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {card1Cfg.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">/</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c1MainIsOp ? "Resultado de operación" : "Universo total"}
                  </span>
                </div>
                <p className="text-5xl font-bold text-foreground tabular-nums leading-none mt-3">
                  {card1MainValue.toLocaleString()}
                </p>
                <div className="flex-1 min-h-6" />
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {card1Sec1Value.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {card1Sec1Pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                      <p className="text-[10px] text-muted-foreground">{card1Cfg.config.secondary_1_label}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {card1Sec2Value.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {card1Sec2Pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      <p className="text-[10px] text-muted-foreground">{card1Cfg.config.secondary_2_label}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B) Card 2 */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {card2Cfg.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50">/</span>
                  <span className="text-[10px] text-muted-foreground">
                    {c2MainIsTotal ? "Universo total" : (card2Cfg.config.main_operation ? "Resultado de operación" : "SKUs con Código SumaGo")}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <p className="text-5xl font-bold text-foreground tabular-nums leading-none">
                    {card2MainValue.toLocaleString()}
                  </p>
                  <span className="text-xs text-muted-foreground tabular-nums">{card2MainPct}% del total</span>
                </div>
                <div className="flex-1 min-h-6" />
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {card2Sec1Value.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {card2Sec1Pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-info shrink-0" />
                      <p className="text-[10px] text-muted-foreground">{card2Cfg.config.secondary_1_label}</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-bold text-foreground tabular-nums">
                        {card2Sec2Value.toLocaleString()}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {card2Sec2Pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-info shrink-0" />
                      <p className="text-[10px] text-muted-foreground">{card2Cfg.config.secondary_2_label}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* C) Card 3 — Completitud */}
            <Card>
              <CardContent className="pt-5 pb-5 px-5 flex flex-col">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">
                    {card3Cfg.label}
                  </span>
                </div>
                {completenessValue !== null ? (
                  <>
                    <p className="text-5xl font-bold text-foreground tabular-nums leading-none mt-3">
                      {completenessValue}%
                    </p>
                    <div className="flex-1 min-h-6" />
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Progreso {completenessReportName}</p>
                      <CompletenessBar value={completenessValue} showLabel={false} size="sm" />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-bold text-muted-foreground/30 tabular-nums leading-none mt-3">—</p>
                    <div className="flex-1 min-h-6" />
                    <div className="pt-4 border-t border-border">
                      <p className="text-xs text-muted-foreground">Informe en proceso…</p>
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

                  {/* Universe guide text */}
                  {activeReport && !loadingFocus && (
                    <div className="text-xs text-muted-foreground mb-3 shrink-0 space-y-0.5">
                      <p>
                        Universo: {activeReport.universe}
                        {focusItems.length > 0 && focusItems[0].totalSKUs > 0 && (
                          <span className="ml-1 font-medium">{focusItems[0].totalSKUs.toLocaleString()} SKUs</span>
                        )}
                      </p>
                      <p>Atributos evaluados: {focusItems.length}{totalEvaluableAttrs > 0 ? ` de ${totalEvaluableAttrs}` : ""}</p>
                    </div>
                  )}

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
