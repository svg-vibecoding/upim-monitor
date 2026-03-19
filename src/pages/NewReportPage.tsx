import { useState, useMemo, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CompletenessBar } from "@/components/CompletenessBar";
import {
  computeAttributeResults, computeDimensionResults, downloadCSV, PIMRecord,
} from "@/data/mockData";
import {
  usePimRecords, useDimensions, useAttributeOrder, getFullAttributeList,
  getAttributeClassification, isNonEvaluable, usePredefinedReports,
  sortReportsByDisplayOrder, getRecordsForReport, getEvaluableAttributes,
  useOperations, evaluateOperation,
  type Condition, type LogicMode,
} from "@/hooks/usePimData";
import { Badge } from "@/components/ui/badge";
import { FileText, Filter, ArrowLeft, Download, Search, CheckSquare, Square, ChevronDown, Check } from "lucide-react";
import { DimensionSummaryCards } from "@/components/DimensionSummaryCards";
import { UniverseSelector, type UniverseSource, type OperationMode, type InlineOperationDef } from "@/components/UniverseSelector";
import * as XLSX from "xlsx";
import { useTrackEvent } from "@/hooks/useTrackEvent";

type Step = "config" | "results";
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

  const [source, setSource] = useState<UniverseSource>("general");
  const [selectedReportId, setSelectedReportId] = useState<string>("");
  const [selectedOperationId, setSelectedOperationId] = useState<string>("");
  const [opMode, setOpMode] = useState<OperationMode>("new");
  const [inlineOp, setInlineOp] = useState<InlineOperationDef>({
    logicMode: "all",
    conditions: [{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }],
  });
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [uploadedFileReady, setUploadedFileReady] = useState(false);
  const [uploadedTotalRows, setUploadedTotalRows] = useState(0);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [dimensionId, setDimensionId] = useState<string>("");
  const [step, setStep] = useState<Step>("config");
  const [searchAttr, setSearchAttr] = useState("");
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | null>(null);
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(false);

  const handleSourceChange = useCallback((s: UniverseSource) => {
    setSource(s);
  }, []);

  const step1Complete = useMemo(() => {
    if (source === "general") return true;
    if (source === "report") return !!selectedReportId;
    if (source === "operation") {
      if (opMode === "existing") return !!selectedOperationId;
      if (opMode === "new") return inlineOp.conditions.some((c) => c.attribute.trim() !== "");
    }
    if (source === "file") return uploadedFileReady && csvCodes.length > 0;
    return false;
  }, [source, selectedReportId, selectedOperationId, opMode, inlineOp, uploadedFileReady, csvCodes]);
  const step2Complete = selectedAttrs.length > 0;

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
      .map((attr) => ({ attr, classification: getAttributeClassification(attr, predefinedReports, dimensionsData, operations) }));
  }, [fullAttributes, searchAttr, predefinedReports, dimensionsData, operations]);

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
    if (source === "operation") {
      if (opMode === "existing" && selectedOperation) {
        return allRecords.filter((r) => evaluateOperation(r, selectedOperation, operations));
      }
      if (opMode === "new" && inlineOp.conditions.some((c) => c.attribute.trim() !== "")) {
        // Build a temporary operation object for evaluation
        const tempOp = {
          id: "__inline__",
          name: "Inline",
          description: "",
          active: true,
          logicMode: inlineOp.logicMode,
          conditions: inlineOp.conditions.filter((c) => c.attribute.trim() !== ""),
          createdAt: "",
          updatedAt: "",
        };
        return allRecords.filter((r) => evaluateOperation(r, tempOp, operations));
      }
    }
    return allRecords;
  }, [source, csvCodes, allRecords, selectedReport, selectedOperation, operations, opMode, inlineOp]);

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
    setOpMode("existing");
    setInlineOp({ logicMode: "all", conditions: [{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }] });
  };

  const universeLabel = useMemo(() => {
    if (source === "general") return "Base general del PIM";
    if (source === "report" && selectedReport) return selectedReport.universe;
    if (source === "operation") {
      if (opMode === "existing" && selectedOperation) return `Operación: ${selectedOperation.name}`;
      if (opMode === "new") return "Operación personalizada";
    }
    if (source === "file" && uploadedFileName) return `Universo de productos personalizado (${uploadedFileName})`;
    return "";
  }, [source, selectedReport, selectedOperation, uploadedFileName, opMode]);

  return (
    <div className="space-y-6 max-w-6xl">
      {step === "config" && (
        <>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground">Crear nuevo informe</h1>
          <p className="text-sm text-muted-foreground">Un informe mide qué tan completa está la información de un conjunto de productos en los atributos que elijas. El resultado muestra qué porcentaje de productos tiene un valor asignado para esos atributos.</p>
        </div>
        <div className="space-y-4">
          {/* Step 1: Universe */}
          <Collapsible open={step1Open} onOpenChange={setStep1Open}>
            <div className="relative rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
              {/* Floating circle indicator — outside card */}
              <div className="absolute -top-2.5 -right-2.5 flex items-center gap-1.5 z-10">
                <span className="text-xs text-muted-foreground">1 de 2</span>
                <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full border-2 text-[11px] font-bold transition-colors ${step1Complete ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 bg-card text-muted-foreground"}`}>
                  {step1Complete ? <Check className="h-3.5 w-3.5" /> : "1"}
                </span>
              </div>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 cursor-pointer rounded-lg">
                <div className="text-left space-y-0.5 pr-20">
                  <p className="text-sm font-semibold">
                    Definición del universo de productos
                    {!step1Open && universeLabel && (
                      <span className="font-normal text-muted-foreground"> · {universeLabel}</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">El universo define qué productos se evalúan: todos los productos del catálogo, un informe predefinido, un subconjunto filtrado mediante una operación, o una lista de productos cargada desde un archivo.</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${step1Open ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <UniverseSelector
                    source={source}
                    onSourceChange={handleSourceChange}
                    selectedOperationId={selectedOperationId}
                    onOperationChange={setSelectedOperationId}
                    operations={operations}
                    operationMode={opMode}
                    onOperationModeChange={setOpMode}
                    inlineOperation={inlineOp}
                    onInlineOperationChange={setInlineOp}
                    attributeList={fullAttributes}
                    selectedReportId={selectedReportId}
                    onReportChange={setSelectedReportId}
                    sortedReports={sortedReports}
                    uploadedFileName={uploadedFileName}
                    uploadedFileReady={uploadedFileReady}
                    uploadedTotalRows={uploadedTotalRows}
                    csvCodesCount={csvCodes.length}
                    matchedCount={allRecords.length > 0 ? allRecords.filter((r) => csvCodes.includes(r.codigoJaivana)).length : undefined}
                    onFileUpload={handleFileUpload}
                    onClearFile={handleClearFile}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Step 2: Attributes */}
          <Collapsible open={step2Open} onOpenChange={setStep2Open}>
            <div className="relative rounded-lg border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
              {/* Floating circle indicator */}
              <div className="absolute -top-3 -right-3 flex items-center gap-1.5 z-10">
                <span className="text-xs text-muted-foreground">2 de 2</span>
                <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full border-2 text-xs font-semibold transition-colors ${step2Complete ? "border-green-500 bg-green-500 text-white" : "border-muted-foreground/30 bg-card text-muted-foreground"}`}>
                  {step2Complete ? <Check className="h-4 w-4" /> : "2"}
                </span>
              </div>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-4 cursor-pointer rounded-lg">
                <div className="text-left space-y-0.5 pr-20">
                  <p className="text-sm font-semibold">
                    Definición de atributos
                    {!step2Open && selectedAttrs.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {selectedAttrs.length} atributos seleccionados</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">Los atributos son las características que describen un producto en el catálogo: desde datos de identificación hasta información comercial, logística o digital. Cada atributo puede evaluarse en los informes para medir su completitud.</p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${step2Open ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Desde un informe:</p>
                    <div className="flex items-center gap-2">
                      <Select onValueChange={handleApplyTemplate}>
                        <SelectTrigger className="w-56 text-xs shrink-0">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Ninguna</SelectItem>
                          {sortedReports.map((r) => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Buscar atributo..."
                          value={searchAttr}
                          onChange={(e) => setSearchAttr(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => setSelectedAttrs(getEvaluableAttributes(fullAttributes))}>
                        <CheckSquare className="h-3 w-3" /> Todos
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => setSelectedAttrs([])}>
                        <Square className="h-3 w-3" /> Ninguno
                      </Button>
                    </div>
                  </div>
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
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">{selectedAttrs.length} seleccionados</Badge>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Dimension (optional, always visible) */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-sm font-semibold">3. Dimensión (opcional)</Label>
              <p className="text-sm text-muted-foreground">Una dimensión distribuye los resultados en los valores únicos de un atributo. Por ejemplo, si seleccionas Categoría Comercial, verás la completitud calculada de forma independiente para cada categoría existente.</p>
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
            <p className="text-sm text-muted-foreground">Generando informe...</p>
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
            <>
              <DimensionSummaryCards dimensionResults={dimensionResults} />
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
