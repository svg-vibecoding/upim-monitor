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
import { ArrowLeft, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { DimensionSummaryCards } from "@/components/DimensionSummaryCards";
import { Badge } from "@/components/ui/badge";
import { useTrackEvent } from "@/hooks/useTrackEvent";
import { type SeverityLevel, getSeverity, focusSeverityColors } from "@/lib/severity";
import { SeverityFilter } from "@/components/SeverityFilter";

/* ── Sort helpers ─────────────────────────────────────────── */

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const trackEvent = useTrackEvent();
  const [selectedDimension, setSelectedDimension] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);
  type SortField = "completeness" | "attribute" | "pim_order";
  type SortDir = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("pim_order");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [tracked, setTracked] = useState(false);

  // Dimension sort & filter state
  type DimSortField = "value" | "completeness";
  const [dimSortField, setDimSortField] = useState<DimSortField>("value");
  const [dimSortDir, setDimSortDir] = useState<SortDir>("asc");
  const [dimSeverityFilter, setDimSeverityFilter] = useState<SeverityLevel | null>(null);

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

  const attrResults = useMemo(() => (completenessData || []).filter(a => !NON_EVALUABLE_FIELDS.includes(a.name)), [completenessData]);
  const avgCompleteness = attrResults.length > 0
    ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
    : 0;
  const totalSKUs = attrResults.length > 0 ? attrResults[0].totalSKUs : 0;

  const pimOrderList = useMemo(() => attributeOrder ? getFullAttributeList(attributeOrder) : [], [attributeOrder]);

  const sortedAttrResults = useMemo(() => {
    const filtered = attrResults.filter((a) => !severityFilter || getSeverity(a.completeness) === severityFilter);
    if (sortField === "pim_order") {
      const sorted = [...filtered];
      sorted.sort((a, b) => {
        const idxA = pimOrderList.indexOf(a.name);
        const idxB = pimOrderList.indexOf(b.name);
        return (idxA === -1 ? 9999 : idxA) - (idxB === -1 ? 9999 : idxB);
      });
      return sorted;
    }
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === "completeness") {
        cmp = a.completeness - b.completeness;
      } else {
        cmp = a.name.localeCompare(b.name, "es");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [attrResults, severityFilter, sortField, sortDir, pimOrderList]);

  const dimension = useMemo(() => dimensions?.find((d) => d.id === selectedDimension), [dimensions, selectedDimension]);
  const records = useMemo(() => {
    if (!report || !needsRecords) return [];
    return getRecordsForReport(allRecords || [], report, operations);
  }, [report, needsRecords, allRecords, operations]);
  const validAttrs = useMemo(() => attrResults.map(a => a.name), [attrResults]);
  const dimensionResults = useMemo(() => {
    if (!dimension || !needsRecords) return [];
    return computeDimensionResults(records, validAttrs, dimension.field);
  }, [dimension, needsRecords, records, validAttrs]);

  const sortedDimensionResults = useMemo(() => {
    if (dimensionResults.length === 0) return [];
    const filtered = dimensionResults.filter((d) => !dimSeverityFilter || getSeverity(d.completeness) === dimSeverityFilter);
    const sinValor = filtered.filter(d => d.value === "Sin valor asignado");
    const rest = filtered.filter(d => d.value !== "Sin valor asignado");
    if (dimSortField === "value") {
      rest.sort((a, b) => {
        const cmp = a.value.localeCompare(b.value, "es");
        return dimSortDir === "asc" ? cmp : -cmp;
      });
    } else {
      rest.sort((a, b) => {
        const cmp = a.completeness - b.completeness;
        return dimSortDir === "asc" ? cmp : -cmp;
      });
    }
    return [...rest, ...sinValor];
  }, [dimensionResults, dimSeverityFilter, dimSortField, dimSortDir]);

  // 3-state cycle: inactive (pim_order) → asc → desc → inactive
  const handleSort = (field: "attribute" | "completeness") => {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortField("pim_order");
      setSortDir("asc");
    }
  };

  // Dimension sort: 3-state cycle, default = value asc (A-Z)
  const handleDimSort = (field: "value" | "completeness") => {
    if (dimSortField !== field) {
      setDimSortField(field);
      setDimSortDir("asc");
    } else if (dimSortDir === "asc") {
      setDimSortDir("desc");
    } else {
      setDimSortField("value");
      setDimSortDir("asc");
    }
  };

  const SortIcon = ({ field, activeField, activeDir }: { field: string; activeField: string; activeDir: "asc" | "desc" }) => {
    if (activeField !== field) return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />;
    return activeDir === "asc"
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
        {(() => {
          const focusCount = attrResults.filter((a) => a.completeness < 50).length;
          const focusPct = attrResults.length > 0 ? Math.round((focusCount / attrResults.length) * 100) : 0;
          const fc = focusSeverityColors(focusPct);
          return (
            <Card className={`relative overflow-hidden border-0 ${fc.bg}`}>
              <CardContent className="pt-4 pb-4 px-4 relative z-10">
                <p className={`text-xs mb-1 ${fc.label}`}>Atributos foco de atención</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-xl font-bold ${fc.text}`}>{focusCount}</span>
                  <span className="text-xs text-muted-foreground">de {attrResults.length}</span>
                  <span className={`text-xl font-bold ${fc.text}`}>{focusPct}%</span>
                </div>
              </CardContent>
              <AlertTriangle className={`absolute bottom-2 right-2 h-12 w-12 ${fc.text} opacity-[0.12]`} />
            </Card>
          );
        })()}
      </div>

      {/* Attribute table */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Detalle por atributo</h2>
            <SeverityFilter results={attrResults} activeFilter={severityFilter} onFilterChange={setSeverityFilter} />
          </div>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button onClick={() => handleSort("attribute")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Atributo <SortIcon field="attribute" activeField={sortField} activeDir={sortDir} />
                    </button>
                  </TableHead>
                  <TableHead className="text-right w-28">SKUs evaluados</TableHead>
                  <TableHead className="text-right w-28">Poblados</TableHead>
                  <TableHead className="w-48">
                    <button onClick={() => handleSort("completeness")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Completitud <SortIcon field="completeness" activeField={sortField} activeDir={sortDir} />
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
            <p className="text-sm text-muted-foreground">Una dimensión distribuye los resultados en los valores únicos de un atributo. Por ejemplo, si seleccionas Categoría Comercial, verás la completitud calculada de forma independiente para cada categoría existente.</p>
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
              <DimensionSummaryCards dimensionResults={dimensionResults} />
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Distribución por {dimension?.name}</h2>
                <SeverityFilter results={dimensionResults} activeFilter={dimSeverityFilter} onFilterChange={setDimSeverityFilter} />
              </div>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button onClick={() => handleDimSort("value")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          {dimension?.name} <SortIcon field="value" activeField={dimSortField} activeDir={dimSortDir} />
                        </button>
                      </TableHead>
                      <TableHead className="text-right w-24">SKUs</TableHead>
                      <TableHead className="text-right w-28">Poblados</TableHead>
                      <TableHead className="w-48">
                        <button onClick={() => handleDimSort("completeness")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                          Completitud <SortIcon field="completeness" activeField={dimSortField} activeDir={dimSortDir} />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDimensionResults.map((d) => (
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
