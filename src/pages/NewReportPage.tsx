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
import { usePimRecords, useDimensions, useAttributeOrder, NON_EVALUABLE_FIELDS, DIMENSION_FIELDS, getFullAttributeList } from "@/hooks/usePimData";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText } from "lucide-react";

type Step = "config" | "results";

export default function NewReportPage() {
  const { data: allRecords = [] } = usePimRecords();
  const { data: dimensionsData = [] } = useDimensions();
  const { data: attributeOrder = [] } = useAttributeOrder();

  const fullAttributes = useMemo(() => {
    return getFullAttributeList(attributeOrder);
  }, [attributeOrder]);

  const [source, setSource] = useState<"general" | "csv">("general");
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [dimensionId, setDimensionId] = useState<string>("");
  const [step, setStep] = useState<Step>("config");
  const [searchAttr, setSearchAttr] = useState("");

  const filteredAttrs = fullAttributes.filter((a) => a.toLowerCase().includes(searchAttr.toLowerCase()));

  const toggleAttr = (attr: string) => {
    setSelectedAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  };

  const records = useMemo(() => {
    if (source === "csv" && csvCodes.length > 0) {
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

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      // Skip header if present
      const codes = lines.filter((l) => l.startsWith("JAV-"));
      setCsvCodes(codes);
    };
    reader.readAsText(file);
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
              <RadioGroup value={source} onValueChange={(v) => setSource(v as "general" | "csv")} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="general" id="src-gen" />
                  <Label htmlFor="src-gen" className="text-sm cursor-pointer">Base general del PIM</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="csv" id="src-csv" />
                  <Label htmlFor="src-csv" className="text-sm cursor-pointer">Cargar CSV</Label>
                </div>
              </RadioGroup>
              {source === "csv" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">El CSV debe tener una sola columna con Código Jaivaná.</p>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer border border-input rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors">
                      <Upload className="h-4 w-4" />
                      Seleccionar archivo
                      <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
                    </label>
                    {csvCodes.length > 0 && (
                      <span className="text-sm text-muted-foreground">{csvCodes.length} códigos cargados</span>
                    )}
                  </div>
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
                {filteredAttrs.map((attr) => (
                  <label key={attr} className="flex items-center gap-2 py-1 px-1 text-sm cursor-pointer hover:bg-accent rounded">
                    <Checkbox checked={selectedAttrs.includes(attr)} onCheckedChange={() => toggleAttr(attr)} />
                    <span className="truncate">{attr}</span>
                  </label>
                ))}
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
