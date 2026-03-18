import { useParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimRecords, usePredefinedReports, useDimensions, useAttributeOrder,
  useReportCompleteness, NON_EVALUABLE_FIELDS, getFullAttributeList,
  computeAttributeResults, computeDimensionResults, getRecordsForReport,
  filterRealAttributes, getEvaluableAttributes, useOperations,
} from "@/hooks/usePimData";
import { downloadCSV } from "@/data/mockData";
import { ArrowLeft, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown, Layers, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTrackEvent } from "@/hooks/useTrackEvent";

/* ── Severity helpers ─────────────────────────────────────────── */
type SeverityLevel = "critical" | "low" | "medium" | "good" | "excellent";

function getSeverity(pct: number): SeverityLevel {
  if (pct < 25) return "critical";
  if (pct < 50) return "low";
  if (pct < 70) return "medium";
  if (pct < 90) return "good";
  return "excellent";
}

function severityLabel(s: SeverityLevel) {
  switch (s) {
    case "critical": return "0–25 %";
    case "low": return "25–50 %";
    case "medium": return "50–70 %";
    case "good": return "70–90 %";
    case "excellent": return "90–100 %";
  }
}

function severityDot(s: SeverityLevel) {
  switch (s) {
    case "critical": return "bg-destructive";
    case "low": return "bg-warning";
    case "medium": return "bg-caution";
    case "good": return "bg-good";
    case "excellent": return "bg-success";
  }
}

const severityLevels: SeverityLevel[] = ["critical", "low", "medium", "good", "excellent"];

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const trackEvent = useTrackEvent();
  const [selectedDimension, setSelectedDimension] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);
  type SortField = "completeness" | "attribute" | "pim_order";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("completeness");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [tracked, setTracked] = useState(false);

  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: dimensions, isLoading: loadingDimensions } = useDimensions();
  const { data: attributeOrder } = useAttributeOrder();
  const { data: operations = [] } = useOperations();

  const totalEvaluableAttrs = useMemo(() => {
    if (!attributeOrder) return 0;
    return getEvaluableAttributes(getFullAttributeList(attributeOrder)).length;
  }, [attributeOrder]);

  const report = reports?.find((r) => r.id === reportId);
  const { data: completenessData, isLoading: loadingCompleteness } = useReportCompleteness(report?.id);

  // Only load all records when a dimension is selected (needed for dimension breakdown)
  const needsRecords = !!selectedDimension;
  const { data: allRecords, isLoading: loadingRecords } = usePimRecords();

  const isLoading = loadingReports || loadingDimensions || loadingCompleteness;


  // Use server-side completeness data (already filtered by universe and evaluable)
  const attrResults = useMemo(() => (completenessData || []).filter(a => !NON_EVALUABLE_FIELDS.includes(a.name)), [completenessData]);
  const avgCompleteness = attrResults.length > 0
    ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
    : 0;
  const totalSKUs = attrResults.length > 0 ? attrResults[0].totalSKUs : 0;

  const pimOrderList = useMemo(() => attributeOrder ? getFullAttributeList(attributeOrder) : [], [attributeOrder]);

  const sortedAttrResults = useMemo(() => {
    const filtered = attrResults.filter((a) => !severityFilter || getSeverity(a.completeness) === severityFilter);
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === "completeness") {
        cmp = a.completeness - b.completeness;
      } else if (sortField === "attribute") {
        cmp = a.name.localeCompare(b.name, "es");
      } else {
        const idxA = pimOrderList.indexOf(a.name);
        const idxB = pimOrderList.indexOf(b.name);
        cmp = (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [attrResults, severityFilter, sortField, sortDir, pimOrderList]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      : <ArrowDown className="h-3.5 w-3.5 text-foreground" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64 w-full" />
        <p className="text-sm text-muted-foreground text-center">Cargando informe...</p>
      </div>
    );
  }

  if (!report) return <div className="p-6">Este informe no tiene atributos para mostrar.</div>;

  // Track report viewed once data loads
  if (!tracked && completenessData && report) {
    setTracked(true);
    trackEvent("report_viewed", {
      report_id: report.id,
      report_name: report.name,
      report_type: "predefined",
    });
  }

  const dimension = dimensions?.find((d) => d.id === selectedDimension);
  const records = needsRecords ? getRecordsForReport(allRecords || [], report, operations) : [];
  const validAttrs = attrResults.map(a => a.name);
  const dimensionResults = dimension && needsRecords ? computeDimensionResults(records, validAttrs, dimension.field) : [];

  const handleDownload = () => {
    const headers = ["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"];
    const rows: (string | number)[][] = attrResults.map((a) => [a.name, a.totalSKUs, a.populated, a.completeness]);

    if (dimensionResults.length > 0 && dimension) {
      rows.push([]);
      rows.push([`Distribución por ${dimension.name}`, "", "", ""]);
      rows.push([dimension.name, "SKUs", "Poblados", "Completitud %"]);
      dimensionResults.forEach((d) => rows.push([d.value, d.totalSKUs, d.populated, d.completeness]));
    }

    downloadCSV(`${report.name.replace(/\s/g, "_")}_resumen.csv`, headers, rows);
    trackEvent("report_downloaded", {
      report_id: report.id,
      report_name: report.name,
      report_type: "predefined",
    });
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/informes")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{report.name}</h1>
          <p className="text-sm text-muted-foreground">{report.universe}</p>
        </div>
        <Button variant="outline" onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" /> Descargar resumen
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">SKUs evaluados</p><p className="text-xl font-bold">{totalSKUs.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos evaluados</p><p className="text-xl font-bold">{attrResults.length}{totalEvaluableAttrs > 0 && <span className="text-sm font-normal text-muted-foreground"> de {totalEvaluableAttrs}</span>}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Completitud promedio</p><p className="text-xl font-bold">{avgCompleteness}%</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos &lt;50%</p><p className="text-xl font-bold text-destructive">{attrResults.filter((a) => a.completeness < 50).length}</p></CardContent></Card>
      </div>

      {/* Attribute table */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Detalle por atributo</h2>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {severityLevels.map((level) => {
                const count = attrResults.filter((a) => getSeverity(a.completeness) === level).length;
                const isActive = severityFilter === level;
                return (
                  <button
                    key={level}
                    onClick={() => setSeverityFilter(isActive ? null : level)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${isActive ? "bg-accent ring-1 ring-ring" : "hover:bg-muted"}`}
                    title={severityLabel(level)}
                  >
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${severityDot(level)}`} />
                    <span className="tabular-nums text-muted-foreground">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => handleSort("attribute")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Atributo <SortIcon field="attribute" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-28">SKUs evaluados</TableHead>
                  <TableHead className="text-right w-28">Poblados</TableHead>
                  <TableHead className="w-48">
                    <button onClick={() => handleSort("completeness")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Completitud <SortIcon field="completeness" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedAttrResults.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.totalSKUs.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.populated.toLocaleString()}</TableCell>
                    <TableCell><CompletenessBar value={a.completeness} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dimension distribution */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3 mb-3">
            <h2 className="text-sm font-semibold text-foreground">Distribución por dimensión</h2>
            <p className="text-sm text-muted-foreground">Distribuye los resultados por una dimensión. Por ejemplo, seleccionar 'Categoría del Producto' mostrará la completitud de los atributos del informe separada para cada categoría: Herramientas, Seguridad Industrial, Tornillería, etc.</p>
            <Select value={selectedDimension} onValueChange={setSelectedDimension}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Sin dimensión" />
              </SelectTrigger>
              <SelectContent>
                {(dimensions || []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedDimension && loadingRecords ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">
                Informe por distribución {dimensions?.find(d => d.id === selectedDimension)?.name} en proceso...
              </p>
            </div>
          ) : dimensionResults.length > 0 ? (
            <>
              {/* Dimension summary cards */}
              {(() => {
                const realGroups = dimensionResults.filter(d => d.value !== "Sin valor asignado");
                const sinValor = dimensionResults.find(d => d.value === "Sin valor asignado");
                const sinValorSKUs = sinValor?.totalSKUs ?? 0;
                const totalSKUsInDim = dimensionResults.reduce((s, d) => s + d.totalSKUs, 0);
                const sinValorPct = totalSKUsInDim > 0 ? (sinValorSKUs / totalSKUsInDim) * 100 : 0;
                const best = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness >= b.completeness ? a : b) : null;
                const worst = realGroups.length > 0 ? realGroups.reduce((a, b) => a.completeness <= b.completeness ? a : b) : null;

                // Sin valor severity
                const svBg = sinValorSKUs === 0 ? "bg-success/10" : sinValorPct > 25 ? "bg-destructive/10" : "bg-warning/10";
                const svText = sinValorSKUs === 0 ? "text-success" : sinValorPct > 25 ? "text-destructive" : "text-warning";
                const SvIcon = sinValorSKUs === 0 ? CheckCircle2 : AlertTriangle;

                return (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {/* Grupos evaluados */}
                    <Card className="relative overflow-hidden">
                      <CardContent className="pt-4 pb-4 px-4 relative z-10">
                        <p className="text-xs text-muted-foreground mb-1">Grupos evaluados</p>
                        <p className="text-3xl font-bold">{realGroups.length}</p>
                      </CardContent>
                      <Layers className="absolute bottom-2 right-2 h-12 w-12 text-primary/[0.06]" />
                    </Card>

                    {/* Mejor completitud */}
                    <Card className="relative overflow-hidden">
                      <CardContent className="pt-4 pb-4 px-4 relative z-10">
                        <p className="text-xs text-muted-foreground mb-1">Mejor completitud</p>
                        {best ? (
                          <>
                            <p className="text-3xl font-bold text-success">{best.completeness}%</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{best.value}</p>
                          </>
                        ) : (
                          <p className="text-xl text-muted-foreground">—</p>
                        )}
                      </CardContent>
                      <TrendingUp className="absolute bottom-2 right-2 h-12 w-12 text-success/[0.08]" />
                    </Card>

                    {/* Grupo a mejorar */}
                    <Card className="relative overflow-hidden">
                      <CardContent className="pt-4 pb-4 px-4 relative z-10">
                        <p className="text-xs text-muted-foreground mb-1">Grupo a mejorar</p>
                        {worst ? (
                          <>
                            <p className="text-3xl font-bold text-destructive">{worst.completeness}%</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{worst.value}</p>
                          </>
                        ) : (
                          <p className="text-xl text-muted-foreground">—</p>
                        )}
                      </CardContent>
                      <TrendingDown className="absolute bottom-2 right-2 h-12 w-12 text-destructive/[0.08]" />
                    </Card>

                    {/* Sin valor asignado */}
                    <Card className={`relative overflow-hidden ${svBg}`}>
                      <CardContent className="pt-4 pb-4 px-4 relative z-10">
                        <p className={`text-xs font-medium mb-1 ${svText}`}>Sin valor asignado</p>
                        {sinValorSKUs === 0 ? (
                          <p className={`text-sm font-semibold ${svText}`}>Todos los SKUs tienen valor asignado</p>
                        ) : (
                          <>
                            <p className={`text-3xl font-bold ${svText}`}>{sinValorSKUs.toLocaleString()}</p>
                            <p className={`text-xs ${svText} opacity-80`}>SKUs sin valor</p>
                          </>
                        )}
                      </CardContent>
                      <SvIcon className={`absolute bottom-2 right-2 h-12 w-12 ${svText} opacity-[0.12]`} />
                    </Card>
                  </div>
                );
              })()}
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dimension?.name}</TableHead>
                    <TableHead className="text-right w-24">SKUs</TableHead>
                    <TableHead className="text-right w-28">Poblados</TableHead>
                    <TableHead className="w-48">Completitud</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dimensionResults.map((d) => (
                    <TableRow key={d.value}>
                      <TableCell className="font-medium text-sm">{d.value}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.totalSKUs.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.populated.toLocaleString()}</TableCell>
                      <TableCell><CompletenessBar value={d.completeness} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Selecciona una dimensión para ver la distribución.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
