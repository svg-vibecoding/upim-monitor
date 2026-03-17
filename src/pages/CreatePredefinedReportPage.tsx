import { useState, useMemo, useCallback, useEffect, memo } from "react";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, Loader2, Search, CheckSquare, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  useAttributeOrder, usePredefinedReports, useDimensions, useOperations,
  useCreatePredefinedReport, useUpdateReportAttributes, useUpdateReportOperation,
  useRefreshComputed,
  getFullAttributeList, getEvaluableAttributes,
  getAttributeClassification, sortReportsByDisplayOrder,
  type Condition, type LogicMode,
} from "@/hooks/usePimData";
import { UniverseSelector, type UniverseSource, type OperationMode, type InlineOperationDef } from "@/components/UniverseSelector";

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
        <Badge variant="outline" className="text-[10px] shrink-0">{classification.type}</Badge>
      )}
      {nonEvaluable && (
        <Badge variant="secondary" className="text-[10px] shrink-0">no evaluable</Badge>
      )}
    </label>
  );
});
AttributeCheckboxItem.displayName = "AttributeCheckboxItem";

export default function CreatePredefinedReportPage() {
  const { reportId } = useParams<{ reportId?: string }>();
  const isEditMode = !!reportId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createReport = useCreatePredefinedReport();
  const updateReportAttrs = useUpdateReportAttributes();
  const updateReportOp = useUpdateReportOperation();

  const { data: attributeOrder = [] } = useAttributeOrder();
  const { data: predefinedReports = [] } = usePredefinedReports();
  const { data: dimensionsData = [] } = useDimensions();
  const { data: operations = [] } = useOperations();

  const sortedReports = useMemo(() => sortReportsByDisplayOrder(predefinedReports), [predefinedReports]);
  const fullAttributes = useMemo(() => getFullAttributeList(attributeOrder), [attributeOrder]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [universeDesc, setUniverseDesc] = useState("");
  const [source, setSource] = useState<UniverseSource>("general");
  const [selectedOperationId, setSelectedOperationId] = useState("");
  const [opMode, setOpMode] = useState<OperationMode>("new");
  const [inlineOp, setInlineOp] = useState<InlineOperationDef>({
    logicMode: "all",
    conditions: [{ sourceType: "attribute", attribute: "", operator: "has_value", value: null }],
  });
  const [selectedReportId, setSelectedReportId] = useState("");
  const [selectedAttrs, setSelectedAttrs] = useState<string[]>([]);
  const [searchAttr, setSearchAttr] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [showInFocus, setShowInFocus] = useState(true);

  // File upload state
  const [csvCodes, setCsvCodes] = useState<string[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadedFileReady, setUploadedFileReady] = useState(false);
  const [uploadedTotalRows, setUploadedTotalRows] = useState(0);

  // Populate form when editing
  useEffect(() => {
    if (isEditMode && predefinedReports.length > 0 && !initialized) {
      const report = predefinedReports.find((r) => r.id === reportId);
      if (report) {
        setName(report.name);
        setDescription(report.description || "");
        setUniverseDesc(report.universe || "");
        setSelectedAttrs(report.attributes);
        if (report.operationId) {
          setSource("operation");
          setSelectedOperationId(report.operationId);
          setOpMode("existing");
        } else {
          setSource("general");
        }
        setShowInFocus(report.showInFocus ?? true);
        setInitialized(true);
      }
    }
  }, [isEditMode, reportId, predefinedReports, initialized]);

  const selectedSet = useMemo(() => new Set(selectedAttrs), [selectedAttrs]);

  const toggleAttr = useCallback((attr: string) => {
    setSelectedAttrs((prev) => prev.includes(attr) ? prev.filter((a) => a !== attr) : [...prev, attr]);
  }, []);

  const filteredAttrsWithClassification = useMemo(() => {
    const search = searchAttr.toLowerCase();
    return fullAttributes
      .filter((a) => a.toLowerCase().includes(search))
      .map((attr) => ({ attr, classification: getAttributeClassification(attr, predefinedReports, dimensionsData, operations) }));
  }, [fullAttributes, searchAttr, predefinedReports, dimensionsData, operations]);

  const handleApplyTemplate = (rid: string) => {
    if (rid === "none") { setSelectedAttrs([]); return; }
    const report = sortedReports.find((r) => r.id === rid);
    if (report) setSelectedAttrs(report.attributes);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setUploadedFileReady(false);
    import("xlsx").then((XLSX) => {
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
              if (val.includes("jaivan") || val.includes("código") || val.includes("codigo")) { codeColIndex = i; break; }
            }
          }
          const codes = dataRows.slice(1).map((row) => String(row[codeColIndex] || "").trim()).filter((v) => v.length > 0);
          setCsvCodes(codes);
          setUploadedFileReady(true);
        } catch {
          setCsvCodes([]);
          setUploadedFileReady(true);
          setUploadedTotalRows(0);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleClearFile = () => {
    setCsvCodes([]);
    setUploadedFileName("");
    setUploadedFileReady(false);
    setUploadedTotalRows(0);
  };

  const resolveOperationId = async (): Promise<string | null> => {
    if (source !== "operation") return null;

    if (opMode === "existing" && selectedOperationId) return selectedOperationId;

    if (opMode === "new") {
      const validConditions = inlineOp.conditions.filter((c) => c.attribute.trim() !== "");
      if (validConditions.length === 0) {
        toast.error("Agrega al menos una condición válida a la operación");
        return "__error__";
      }
      const opPayload = {
        name: `Op: ${name.trim()}`,
        description: `Operación creada para el informe "${name.trim()}"`,
        logic_mode: inlineOp.logicMode,
        conditions: validConditions,
        active: true,
      };
      const { data: opData, error: opError } = await supabase.from("operations" as any).insert(opPayload).select("id").single();
      if (opError) throw opError;
      queryClient.invalidateQueries({ queryKey: ["operations"] });
      return (opData as any).id;
    }

    return null;
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (selectedAttrs.length === 0) { toast.error("Selecciona al menos un atributo"); return; }

    setSaving(true);
    try {
      const opId = await resolveOperationId();
      if (opId === "__error__") { setSaving(false); return; }

      if (isEditMode) {
        // Update existing report
        await updateReportOp.mutateAsync({ reportId: reportId!, operationId: opId });
        await updateReportAttrs.mutateAsync({ reportId: reportId!, attributes: selectedAttrs });

        // Update name/description
        const { error } = await supabase.from("predefined_reports").update({
          name: name.trim(),
          description: description.trim(),
          universe: universeDesc.trim(),
          show_in_focus: showInFocus,
        } as any).eq("id", reportId!);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });

        toast.success("Informe actualizado exitosamente");
      } else {
        await createReport.mutateAsync({
          name: name.trim(),
          description: description.trim(),
          operationId: opId,
          attributes: selectedAttrs,
          showInFocus,
          universe: universeDesc.trim(),
        });
        toast.success("Informe creado exitosamente");
      }
      navigate("/admin");
    } catch (err) {
      toast.error(`Error al guardar: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const canSave = name.trim().length > 0 && selectedAttrs.length > 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          {isEditMode ? `Editar informe — ${name}` : "Crear informe predefinido"}
        </h1>
      </div>

      {/* Name & Description */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label className="text-sm font-semibold">Nombre del informe</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Portafolio premium"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-semibold">Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción del informe"
              rows={2}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Universe */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <Label className="text-sm font-semibold">1. Definición del universo de productos</Label>
          <UniverseSelector
            source={source}
            onSourceChange={setSource}
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
            onFileUpload={handleFileUpload}
            onClearFile={handleClearFile}
          />
          <div className="pt-2">
            <Label className="text-sm font-semibold">Descripción del universo</Label>
            <Input
              value={universeDesc}
              onChange={(e) => setUniverseDesc(e.target.value)}
              placeholder={
                source === "operation" && selectedOperationId
                  ? operations.find((o) => o.id === selectedOperationId)?.name || "Ej: Productos activos del canal B2B"
                  : "Ej: Base general del PIM"
              }
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">Texto que se mostrará en la tarjeta del informe. Si lo dejas vacío, se usará el nombre de la operación asignada.</p>
          </div>
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

          <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar atributo..."
                value={searchAttr}
                onChange={(e) => setSearchAttr(e.target.value)}
                className="pl-9"
              />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setSelectedAttrs(getEvaluableAttributes(fullAttributes))}>
              <CheckSquare className="h-3 w-3" /> Todos
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => setSelectedAttrs([])}>
              <Square className="h-3 w-3" /> Ninguno
            </Button>
            <Badge variant="secondary">{selectedAttrs.length} seleccionados</Badge>
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
            <p className="text-xs text-muted-foreground">{selectedAttrs.length} atributos seleccionados</p>
          )}
        </CardContent>
      </Card>

      {/* Toggle: Incluir en Focos de atención */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="show-in-focus">Incluir en Focos de atención</Label>
              <p className="text-xs text-muted-foreground">Este informe aparecerá como tab en el bloque Focos de atención del dashboard</p>
            </div>
            <Switch id="show-in-focus" checked={showInFocus} onCheckedChange={setShowInFocus} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={!canSave || saving} className="gap-2">
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        <FileText className="h-4 w-4" />
        {isEditMode ? "Guardar cambios" : "Crear informe predefinido"}
      </Button>
    </div>
  );
}
