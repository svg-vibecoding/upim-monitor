import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompletenessBar } from "@/components/CompletenessBar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePimRecords, usePredefinedReports, useDimensions, useAttributeOrder,
  computeAttributeResults, computeDimensionResults, getRecordsForReport,
  filterRealAttributes,
} from "@/hooks/usePimData";
import { downloadCSV } from "@/data/mockData";
import { ArrowLeft, Download } from "lucide-react";

export default function ReportDetailPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [selectedDimension, setSelectedDimension] = useState<string>("");

  const { data: allRecords, isLoading: loadingRecords } = usePimRecords();
  const { data: reports, isLoading: loadingReports } = usePredefinedReports();
  const { data: dimensions, isLoading: loadingDimensions } = useDimensions();
  const { data: attributeOrder } = useAttributeOrder();

  const isLoading = loadingRecords || loadingReports || loadingDimensions;

  const report = reports?.find((r) => r.id === reportId);

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

  const records = getRecordsForReport(allRecords || [], report);
  const validAttrs = filterRealAttributes(report.attributes, attributeOrder || []);
  const attrResults = computeAttributeResults(records, validAttrs);
  const avgCompleteness = attrResults.length > 0
    ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length)
    : 0;

  const dimension = dimensions?.find((d) => d.id === selectedDimension);
  const dimensionResults = dimension ? computeDimensionResults(records, validAttrs, dimension.field) : [];

  const handleDownload = () => {
    const headers = ["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"];
    const rows = attrResults.map((a) => [a.name, a.totalSKUs, a.populated, a.completeness]);
    downloadCSV(`${report.name.replace(/\s/g, "_")}_resumen.csv`, headers, rows);
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
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">SKUs evaluados</p><p className="text-xl font-bold">{records.length.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos evaluados</p><p className="text-xl font-bold">{validAttrs.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Completitud promedio</p><p className="text-xl font-bold">{avgCompleteness}%</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos &lt;50%</p><p className="text-xl font-bold text-destructive">{attrResults.filter((a) => a.completeness < 50).length}</p></CardContent></Card>
      </div>

      {/* Attribute table */}
      <Card>
        <CardContent className="pt-4">
          <h2 className="text-sm font-semibold mb-3 text-foreground">Detalle por atributo</h2>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atributo</TableHead>
                  <TableHead className="text-right w-28">SKUs evaluados</TableHead>
                  <TableHead className="text-right w-28">Poblados</TableHead>
                  <TableHead className="w-48">Completitud</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attrResults.map((a) => (
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
          {dimensionResults.length > 0 ? (
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
