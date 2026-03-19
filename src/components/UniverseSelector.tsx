import { memo, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OperationBuilder } from "@/components/OperationBuilder";
import type { PredefinedReport } from "@/data/mockData";
import type { Operation, Condition, LogicMode } from "@/hooks/usePimData";

export type UniverseSource = "general" | "file" | "report" | "operation";
export type OperationMode = "existing" | "new";

export interface InlineOperationDef {
  logicMode: LogicMode;
  conditions: Condition[];
}

export interface UniverseSelectorProps {
  source: UniverseSource;
  onSourceChange: (source: UniverseSource) => void;
  availableSources?: UniverseSource[];
  // Operation — existing
  selectedOperationId: string;
  onOperationChange: (id: string) => void;
  operations: Operation[];
  // Operation — inline creation
  operationMode?: OperationMode;
  onOperationModeChange?: (mode: OperationMode) => void;
  inlineOperation?: InlineOperationDef;
  onInlineOperationChange?: (def: InlineOperationDef) => void;
  /** PIM attribute list needed for inline OperationBuilder */
  attributeList?: string[];
  // Report (optional)
  selectedReportId?: string;
  onReportChange?: (id: string) => void;
  sortedReports?: PredefinedReport[];
  // File (optional)
  uploadedFileName?: string;
  uploadedFileReady?: boolean;
  uploadedTotalRows?: number;
  csvCodesCount?: number;
  matchedCount?: number;
  onFileUpload?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile?: () => void;
}

const SOURCE_LABELS: Record<UniverseSource, string> = {
  general: "Todos los productos",
  report: "Informe predefinido",
  operation: "Operación",
  file: "Cargar archivo Excel",
};

const SOURCE_ORDER: UniverseSource[] = ["general", "report", "operation", "file"];

export const UniverseSelector = memo(function UniverseSelector({
  source,
  onSourceChange,
  availableSources,
  selectedOperationId,
  onOperationChange,
  operations,
  operationMode = "existing",
  onOperationModeChange,
  inlineOperation,
  onInlineOperationChange,
  attributeList = [],
  selectedReportId = "",
  onReportChange,
  sortedReports = [],
  uploadedFileName = "",
  uploadedFileReady = false,
  uploadedTotalRows = 0,
  csvCodesCount = 0,
  matchedCount,
  onFileUpload,
  onClearFile,
}: UniverseSelectorProps) {
  const sources = availableSources || SOURCE_ORDER;
  const activeOperations = useMemo(() => operations.filter((op) => op.active), [operations]);
  const selectedOperation = useMemo(() => operations.find((op) => op.id === selectedOperationId), [operations, selectedOperationId]);
  const selectedReport = useMemo(() => sortedReports.find((r) => r.id === selectedReportId), [sortedReports, selectedReportId]);

  const supportsInline = !!onOperationModeChange && !!onInlineOperationChange;

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold">Universo de productos</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Define el universo de productos sobre el cual se construirá el informe.
        </p>
      </div>
      <RadioGroup
        value={source}
        onValueChange={(v) => onSourceChange(v as UniverseSource)}
        className="flex flex-wrap gap-4"
      >
        {sources.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <RadioGroupItem value={s} id={`src-${s}`} />
            <Label htmlFor={`src-${s}`} className="text-sm cursor-pointer">
              {SOURCE_LABELS[s]}
            </Label>
          </div>
        ))}
      </RadioGroup>

      {source === "general" && (
        <p className="text-xs text-muted-foreground">SKUs totales (activos e inactivos)</p>
      )}

      {source === "operation" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Define o selecciona una operación para determinar el universo de productos que se analizará.
          </p>

          {supportsInline && (
            <ToggleGroup
              type="single"
              value={operationMode}
              onValueChange={(v) => v && onOperationModeChange!(v as OperationMode)}
              className="justify-start"
            >
              <ToggleGroupItem
                value="new"
                className="text-xs px-3 border border-input bg-accent/50 hover:bg-accent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
              >
                Crear nueva operación
              </ToggleGroupItem>
              <ToggleGroupItem
                value="existing"
                className="text-xs px-3 border border-input bg-accent/50 hover:bg-accent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:border-primary"
              >
                Seleccionar existente
              </ToggleGroupItem>
            </ToggleGroup>
          )}

          {operationMode === "existing" || !supportsInline ? (
            <div className="space-y-2">
              <Select value={selectedOperationId} onValueChange={onOperationChange}>
                <SelectTrigger className="w-72">
                  <SelectValue placeholder="Seleccionar operación" />
                </SelectTrigger>
                <SelectContent>
                  {activeOperations.map((op) => (
                    <SelectItem key={op.id} value={op.id}>{op.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOperation?.description && (
                <p className="text-xs text-muted-foreground">{selectedOperation.description}</p>
              )}
            </div>
          ) : inlineOperation && (
            <div className="rounded-md border border-border bg-muted/10 p-4">
              <OperationBuilder
                idPrefix="universe-op"
                logicMode={inlineOperation.logicMode}
                onLogicModeChange={(mode) =>
                  onInlineOperationChange!({ ...inlineOperation, logicMode: mode })
                }
                conditions={inlineOperation.conditions}
                onConditionsChange={(conds) =>
                  onInlineOperationChange!({ ...inlineOperation, conditions: conds })
                }
                attributeList={attributeList}
                allOperations={operations}
                editingOperationId={null}
              />
            </div>
          )}
        </div>
      )}

      {source === "report" && onReportChange && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Utiliza el universo de productos definido en un informe existente como base para el análisis.
          </p>
          <Select value={selectedReportId} onValueChange={onReportChange}>
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

      {source === "file" && onFileUpload && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            El archivo debe tener una columna con Código Jaivaná. Se aceptan archivos .xlsx y .xls.
          </p>
          {!uploadedFileName ? (
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-input rounded-md px-4 py-3 text-sm hover:bg-accent transition-colors w-fit">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span>Seleccionar archivo</span>
              <input type="file" accept=".xlsx,.xls" onChange={onFileUpload} className="hidden" />
            </label>
          ) : (
            <div className="flex items-center gap-3 border border-input rounded-md px-4 py-3 bg-muted/30">
              <FileSpreadsheet className="h-5 w-5 text-success shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{uploadedFileName}</p>
                {uploadedFileReady ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {csvCodesCount > 0 ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-success" />
                        <span className="text-xs text-muted-foreground">
                          {uploadedTotalRows} fila{uploadedTotalRows !== 1 ? "s" : ""} · {csvCodesCount} código{csvCodesCount !== 1 ? "s" : ""} detectado{csvCodesCount !== 1 ? "s" : ""}
                        </span>
                        {matchedCount !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            · {matchedCount} coinciden en la base
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
              {onClearFile && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClearFile}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
