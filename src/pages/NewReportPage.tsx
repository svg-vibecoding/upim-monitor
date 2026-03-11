import { useState, useMemo } from "react";
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
import { usePimRecords, useDimensions, useAttributeOrder, getFullAttributeList, getAttributeClassification, isNonEvaluable } from "@/hooks/usePimData";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

type Step = "config" | "results";

export default function NewReportPage() {
  const { data: allRecords = [] } = usePimRecords();
  const { data: dimensionsData = [] } = useDimensions();
  const { data: attributeOrder = [] } = useAttributeOrder();

  const fullAttributes = useMemo(() => {
    return getFullAttributeList(attributeOrder);
  }, [attributeOrder]);

  const [source, setSource] = useState<"general" | "file">("general");
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [dimensionId, setDimensionId] = useState<string>("");
  const [step, setStep] = useState<Step>("config");
  const [searchAttr, setSearchAttr] = useState("");

  const filteredAttrs = fullAttributes.filter((a) => a.toLowerCase().includes(searchAttr.toLowerCase()));

  const toggleAttr = (attr: string) => {
    setSelectedAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  };

  const records = useMemo(() => {
    if (source === "file" && csvCodes.length > 0) {
      return allRecords.filter((r) => csvCodes.includes(r.codigoJaivana));
    }
    return allRecords;
  }, [source, csvCodes, allRecords]);

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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const data = new Uint8Array(ev.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Extract codes starting with JAV- from first column
      const codes = rows
        .map((row) => String(row[0] || "").trim())
        .filter((val) => val.startsWith("JAV-"));
      setCsvCodes(codes);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleClearFile = () => {
    setCsvCodes([]);
    setUploadedFileName("");
  };

  const canGenerate = selectedAttrs.length > 0;

  const handleGenerate = () => {
    if (canGenerate) setStep("results");
  };

  const handleDownload = () => {
    const headers = ["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"];
    const rows = attrResults.map((a) => [a.name, a.totalSKUs, a.populated, a.completeness]);
    downloadCSV("informe_personalizado.csv", headers, rows);
  };

  const handleReset = () => {
    setStep("config");
    setSelectedAttrs([]);
    setDimensionId("");
    setCsvCodes([]);
    setSource("general");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-foreground">Crear nuevo informe</h1>

      {step === "config" && (
        <div className="space-y-4">
          {/* Source */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-sm font-semibold">1. Seleccionar fuente</Label>
              <RadioGroup value={source} onValueChange={(v) => setSource(v as "general" | "file")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="general" id="src-gen" />
                  <Label htmlFor="src-gen" className="text-sm cursor-pointer">Base general del PIM</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="file" id="src-file" />
                  <Label htmlFor="src-file" className="text-sm cursor-pointer">Cargar archivo Excel</Label>
                </div>
              </RadioGroup>
              {source === "file" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">El archivo debe tener una columna con Código Jaivaná (formato JAV-XXXXX). Se aceptan archivos .xlsx y .xls.</p>
                  {csvCodes.length === 0 ? (
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
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          <span className="text-xs text-muted-foreground">
                            {csvCodes.length} código{csvCodes.length !== 1 ? "s" : ""} Jaivaná encontrado{csvCodes.length !== 1 ? "s" : ""}
                          </span>
                          {allRecords.length > 0 && (
                            <span className="text-xs text-muted-foreground">
                              · {allRecords.filter((r) => csvCodes.includes(r.codigoJaivana)).length} coinciden en la base
                            </span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleClearFile}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Attributes */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <Label className="text-sm font-semibold">2. Seleccionar atributos</Label>
              <input
                type="text"
                placeholder="Buscar atributo..."
                value={searchAttr}
                onChange={(e) => setSearchAttr(e.target.value)}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1 max-h-64 overflow-auto">
                {/* Código Jaivaná — always selected, not removable */}
                <label className="flex items-center gap-2 py-1 px-1 text-sm rounded opacity-70">
                  <Checkbox checked={true} disabled />
                  <span className="truncate">Código Jaivaná</span>
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0">siempre visible</Badge>
                </label>
                {filteredAttrs.map((attr) => {
                  const classification = getAttributeClassification(attr);
                  const nonEvaluable = !classification.evaluable;
                  const showTypeBadge = classification.type !== "general";
                  return (
                    <label key={attr} className={`flex items-center gap-2 py-1 px-1 text-sm cursor-pointer hover:bg-accent rounded ${nonEvaluable ? "opacity-60" : ""}`}>
                      <Checkbox checked={selectedAttrs.includes(attr)} onCheckedChange={() => toggleAttr(attr)} />
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
                })}
              </div>
              {selectedAttrs.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedAttrs.length} atributos seleccionados</p>
              )}
            </CardContent>
          </Card>

          {/* Dimension */}
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
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {records.length.toLocaleString()} SKUs · {selectedAttrs.length} atributos · Completitud promedio: {avgCompleteness}%
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>Nuevo informe</Button>
              <Button onClick={handleDownload} className="gap-2">Descargar resumen</Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
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
