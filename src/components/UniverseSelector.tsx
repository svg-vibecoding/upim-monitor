import { memo, useMemo } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, X, CheckCircle2 } from "lucide-react";
import type { PredefinedReport } from "@/data/mockData";
import type { Operation } from "@/hooks/usePimData";

export type UniverseSource = "general" | "file" | "report" | "operation";

export interface UniverseSelectorProps {
  source: UniverseSource;
  onSourceChange: (source: UniverseSource) => void;
  /** Which source options to show. Defaults to all four. */
  availableSources?: UniverseSource[];
  // Operation
  selectedOperationId: string;
  onOperationChange: (id: string) => void;
  operations: Operation[];
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
  general: "Base general del PIM",
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

  return (
    <div className="space-y-3">
      <div>
        <Label className="text-sm font-semibold">Universo de productos</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecciona el universo de productos sobre el cual se construirá el informe.
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
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Utiliza una operación existente para definir el universo de productos que se analizará.
          </p>
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
