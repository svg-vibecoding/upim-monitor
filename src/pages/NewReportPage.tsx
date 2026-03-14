import { useState, useMemo, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompletenessBar } from "@/components/CompletenessBar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  computeAttributeResults, computeDimensionResults, downloadCSV, PIMRecord,
} from "@/data/mockData";
import {
  usePimRecords, useDimensions, useAttributeOrder, getFullAttributeList,
  getAttributeClassification, isNonEvaluable, usePredefinedReports,
  sortReportsByDisplayOrder, getRecordsForReport, getEvaluableAttributes,
  useOperations, evaluateOperation,
} from "@/hooks/usePimData";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, FileSpreadsheet, X, CheckCircle2, Filter, ArrowLeft, Download, Settings2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Step = "config" | "results";
type Source = "general" | "file" | "report";
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

const AttributeCheckboxItem = memo(({ attr, classification, checked, onToggle }: {
  attr: string;
  classification: { type: string; evaluable: boolean };
  checked: boolean;
  onToggle: (attr: string) => void;
}) => {
  const nonEvaluable = !classification.evaluable;
  const showTypeBadge = classification.type !== "general";
  return (
    <label className={`flex items-center gap-2 py-1 px-1 text-sm cursor-pointer hover:bg-accent rounded ${nonEvaluable ? "opacity-60" : ""}`}>
      <Checkbox checked={checked} onCheckedChange={() => onToggle(attr)} />
      <span className="truncate">{attr}</span>
      {showTypeBadge && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {classification.type}
        </Badge>
      )}
      {nonEvaluable && (
        <Badge variant="secondary" className="text-[10px] shrink-0">
          no evaluable
        </Badge>
      )}
    </label>
  );
});
AttributeCheckboxItem.displayName = "AttributeCheckboxItem";

export default function NewReportPage() {
  const trackEvent = useTrackEvent();

  const [source, setSource] = useState<Source>("general");
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [selectedOperationId, setSelectedOperationId] = useState<string>("");
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileReady, setUploadedFileReady] = useState(false);
  const [uploadedTotalRows, setUploadedTotalRows] = useState(0);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [dimensionId, setDimensionId] = useState<string>("");
  const [step, setStep] = useState<Step>("config");
  const [searchAttr, setSearchAttr] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);

  const shouldFetchRecords = step === "results";
  const { data: allRecords = [], isLoading: isLoadingRecords } = usePimRecords({ enabled: shouldFetchRecords });
  const { data: dimensionsData = [] } = useDimensions();
  const { data: attributeOrder = [] } = useAttributeOrder();
  const { data: predefinedReports = [] } = usePredefinedReports();
  const { data: operations = [] } = useOperations();

  const sortedReports = useMemo(() => sortReportsByDisplayOrder(predefinedReports), [predefinedReports]);

  const fullAttributes = useMemo(() => {
    return getFullAttributeList(attributeOrder);
  }, [attributeOrder]);

  const totalEvaluableAttrs = useMemo(() => {
    return getEvaluableAttributes(fullAttributes).length;
  }, [fullAttributes]);

  const filteredAttrsWithClassification = useMemo(() => {
    const search = searchAttr.toLowerCase();
    return fullAttributes
      .filter((a) => a.toLowerCase().includes(search))
      .map((attr) => ({ attr, classification: getAttributeClassification(attr, predefinedReports, dimensionsData) }));
  }, [fullAttributes, searchAttr]);

  const selectedSet = useMemo(() => new Set(selectedAttrs), [selectedAttrs]);

  const toggleAttr = useCallback((attr: string) => {
    setSelectedAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  }, []);

  const selectedReport = sortedReports.find((r) => r.id === selectedReportId);
  const selectedOperation = operations.find((op) => op.id === selectedOperationId);

  const records = useMemo(() => {
    if (source === "file" && csvCodes.length > 0) {
      return allRecords.filter((r) => csvCodes.includes(r.codigoJaivana));
    }
    if (source === "report" && selectedReport) {
      return getRecordsForReport(allRecords, selectedReport, operations);
    }
    if (source === "operation" && selectedOperation) {
      return allRecords.filter((r) => evaluateOperation(r, selectedOperation, operations));
    }
    return allRecords;
  }, [source, csvCodes, allRecords, selectedReport, selectedOperation, operations]);

  const attrResults = useMemo(() => {
    if (step !== "results") return [];
    return computeAttributeResults(records, selectedAttrs);
  }, [step, records, selectedAttrs]);

  const dimension = dimensionsData.find((d) => d.id === dimensionId);
  const dimensionResults = useMemo(() => {
    if (step !== "results" || !dimension) return [];
    return computeDimensionResults(records, selectedAttrs, dimension.field);
  }, [step, records, selectedAttrs, dimension]);

  const avgCompleteness = attrResults.length > 0 ? Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length) : 0;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileReady(false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const dataRows = rows.filter((r) => r.length > 0);
        setUploadedTotalRows(Math.max(0, dataRows.length - 1));
        let codeColIndex = 0;
        if (dataRows.length > 0) {
          const headerRow = dataRows[0];
          for (let i = 0; i < headerRow.length; i++) {
            const val = String(headerRow[i] || "").toLowerCase();
            if (val.includes("jaivan") || val.includes("código") || val.includes("codigo")) {
              codeColIndex = i;
              break;
            }
          }
        }
        const codes = dataRows.slice(1)
          .map((row) => String(row[codeColIndex] || "").trim())
          .filter((val) => val.length > 0);
        setCsvCodes(codes);
        setUploadedFileReady(true);
      } catch {
        setUploadedFileName(file.name);
        setCsvCodes([]);
        setUploadedFileReady(true);
        setUploadedTotalRows(0);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearFile = () => {
    setCsvCodes([]);
    setUploadedFileName("");
    setUploadedFileReady(false);
    setUploadedTotalRows(0);
  };

  const handleApplyTemplate = (reportId: string) => {
    if (reportId === "none") {
      setSelectedAttrs([]);
      return;
    }
    const report = sortedReports.find((r) => r.id === reportId);
    if (report) {
      setSelectedAttrs(report.attributes);
    }
  };

  const canGenerate = selectedAttrs.length > 0;

  const handleGenerate = () => {
    if (canGenerate) {
      setStep("results");
      trackEvent("report_created", {
        report_type: "custom",
        source_type: source === "file" ? "csv" : "base_pim",
      });
    }
  };

  const handleDownload = () => {
    const headers = ["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"];
    const rows = attrResults.map((a) => [a.name, a.totalSKUs, a.populated, a.completeness]);
    downloadCSV("informe_personalizado.csv", headers, rows);
    trackEvent("report_downloaded", {
      report_type: "custom",
      source_type: source === "file" ? "csv" : "base_pim",
    });
  };

  const handleReset = () => {
    setStep("config");
    setSelectedAttrs([]);
    setDimensionId("");
    setCsvCodes([]);
    setUploadedFileName("");
    setUploadedFileReady(false);
    setUploadedTotalRows(0);
    setSource("general");
    setSelectedReportId("");
    setSelectedOperationId("");
  };

  const universeLabel = useMemo(() => {
    if (source === "general") return "Base general del PIM";
    if (source === "report" && selectedReport) return selectedReport.universe;
    if (source === "operation" && selectedOperation) return `Operación: ${selectedOperation.name}`;
    if (source === "file" && uploadedFileName) return `Universo de productos personalizado (${uploadedFileName})`;
    return "";
  }, [source, selectedReport, selectedOperation, uploadedFileName]);

  return (
    <div className="space-y-6 max-w-6xl">
      {step === "config" && (
        <>
        <h1 className="text-2xl font-bold text-foreground">Crear nuevo informe</h1>
        <div className="space-y-4">
          {/* Step 1: Universe */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold">1. Seleccionar universo</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Selecciona el universo de productos sobre el cual se construirá el informe.</p>
              </div>
              <RadioGroup value={source} onValueChange={(v) => setSource(v as Source)} className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="general" id="src-gen" />
                  <Label htmlFor="src-gen" className="text-sm cursor-pointer">Base general del PIM</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="report" id="src-report" />
                  <Label htmlFor="src-report" className="text-sm cursor-pointer">Informe predefinido</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="operation" id="src-operation" />
                  <Label htmlFor="src-operation" className="text-sm cursor-pointer">Operación</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="file" id="src-file" />
                  <Label htmlFor="src-file" className="text-sm cursor-pointer">Cargar archivo Excel</Label>
                </div>
              </RadioGroup>

              {source === "general" && (
                <p className="text-xs text-muted-foreground">SKUs totales (activos e inactivos)</p>
              )}

              {source === "file" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">El archivo debe tener una columna con Código Jaivaná. Se aceptan archivos .xlsx y .xls.</p>
                  {!uploadedFileName ? (
                    <label className="flex items-center gap-2 cursor-pointer border border-dashed border-input rounded-md px-4 py-3 text-sm hover:bg-accent transition-colors w-fit">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span>Seleccionar archivo</span>
                      <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 border border-input rounded-md px-4 py-3 bg-muted/30">
                      <FileSpreadsheet className="h-5 w-5 text-success shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                        {uploadedFileReady ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {csvCodes.length > 0 ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 text-success" />
                                <span className="text-xs text-muted-foreground">
                                  {uploadedTotalRows} fila{uploadedTotalRows !== 1 ? "s" : ""} · {csvCodes.length} código{csvCodes.length !== 1 ? "s" : ""} detectado{csvCodes.length !== 1 ? "s" : ""}
                                </span>
                                {allRecords.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    · {allRecords.filter((r) => csvCodes.includes(r.codigoJaivana)).length} coinciden en la base
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-destructive">No se encontraron códigos en el archivo</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Procesando…</span>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClearFile}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {source === "report" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Utiliza el universo de productos definido en un informe existente como base para el análisis.</p>
                  <Select value={selectedReportId} onValueChange={setSelectedReportId}>
                    <SelectTrigger className="w-72">
                      <SelectValue placeholder="Seleccionar informe" />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedReports.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReport && (
                    <p className="text-xs text-muted-foreground">{selectedReport.universe}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Attributes */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">2. Seleccionar atributos</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Cargar plantilla de:</span>
                  <Select onValueChange={handleApplyTemplate}>
                    <SelectTrigger className="w-56 h-8 text-xs">
                      <SelectValue placeholder="Ninguna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ninguna</SelectItem>
                      {sortedReports.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <input
                type="text"
                placeholder="Buscar atributo..."
                value={searchAttr}
                onChange={(e) => setSearchAttr(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-64 overflow-auto">
                <label className="flex items-center gap-2 py-1 px-1 text-sm rounded opacity-70">
                  <Checkbox checked={true} disabled />
                  <span className="truncate">Código Jaivaná</span>
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0">siempre visible</Badge>
                </label>
                {filteredAttrsWithClassification.map(({ attr, classification }) => (
                  <AttributeCheckboxItem
                    key={attr}
                    attr={attr}
                    classification={classification}
                    checked={selectedSet.has(attr)}
                    onToggle={toggleAttr}
                  />
                ))}
              </div>
              {selectedAttrs.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedAttrs.length} atributos seleccionados</p>
              )}
            </CardContent>
          </Card>

          {/* Step 3: Dimension */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-sm font-semibold">3. Dimensión (opcional)</Label>
              <Select value={dimensionId} onValueChange={setDimensionId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Sin dimensión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin dimensión</SelectItem>
                  {dimensionsData.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Button onClick={handleGenerate} disabled={!canGenerate} className="gap-2">
            <FileText className="h-4 w-4" /> Generar informe
          </Button>
        </div>
        </>
      )}

      {step === "results" && isLoadingRecords && (
        <Card>
          <CardContent className="pt-6 pb-8 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Informe en proceso…</p>
          </CardContent>
        </Card>
      )}

      {step === "results" && !isLoadingRecords && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleReset}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">Informe personalizado</h1>
              <p className="text-sm text-muted-foreground">{universeLabel}</p>
            </div>
            <Button variant="outline" onClick={handleDownload} className="gap-2">
              <Download className="h-4 w-4" /> Descargar resumen
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">SKUs evaluados</p><p className="text-xl font-bold">{records.length.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos evaluados</p><p className="text-xl font-bold">{selectedAttrs.length}{totalEvaluableAttrs > 0 && <span className="text-sm font-normal text-muted-foreground"> de {totalEvaluableAttrs}</span>}</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Completitud promedio</p><p className="text-xl font-bold">{avgCompleteness}%</p></CardContent></Card>
            <Card><CardContent className="pt-4 pb-4 px-4"><p className="text-xs text-muted-foreground">Atributos &lt;50%</p><p className="text-xl font-bold text-destructive">{attrResults.filter((a) => a.completeness < 50).length}</p></CardContent></Card>
          </div>

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
                      <TableHead>Atributo</TableHead>
                      <TableHead className="text-right w-28">SKUs evaluados</TableHead>
                      <TableHead className="text-right w-28">Poblados</TableHead>
                      <TableHead className="w-48">Completitud</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attrResults
                      .filter((a) => !severityFilter || getSeverity(a.completeness) === severityFilter)
                      .map((a) => (
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

          {dimensionResults.length > 0 && dimension && (
            <Card>
              <CardContent className="pt-4">
                <h2 className="text-sm font-semibold mb-3 text-foreground">Distribución por {dimension.name}</h2>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{dimension.name}</TableHead>
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
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
