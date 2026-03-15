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
import { ArrowLeft, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTrackEvent } from "@/hooks/useTrackEvent";

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

const severityLevels: SeverityLevel[] = ["critical", "low", "medium", "acceptable"];

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
      </div>
    );
  }

  if (!report) return <div className="p-6">Informe no encontrado.</div>;

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Distribución por dimensión</h2>
            <Select value={selectedDimension} onValueChange={setSelectedDimension}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar dimensión" />
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
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Selecciona una dimensión para ver la distribución.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
