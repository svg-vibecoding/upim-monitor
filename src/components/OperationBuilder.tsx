import { memo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Plus, X } from "lucide-react";
import {
  getValidOperationRefs,
  type Condition,
  type ConditionSourceType,
  type OperatorType,
  type LogicMode,
  type Operation,
} from "@/hooks/usePimData";

export interface OperationBuilderProps {
  /** Unique prefix for radio IDs to avoid collisions when multiple builders on page */
  idPrefix?: string;
  logicMode: LogicMode;
  onLogicModeChange: (mode: LogicMode) => void;
  conditions: Condition[];
  onConditionsChange: (conditions: Condition[]) => void;
  /** Full list of PIM attributes for the attribute selector */
  attributeList: string[];
  /** All operations available (for operation-type conditions) */
  allOperations: Operation[];
  /** ID of the operation being edited (to exclude from refs). Null for new/inline. */
  editingOperationId?: string | null;
}

export const OperationBuilder = memo(function OperationBuilder({
  idPrefix = "op",
  logicMode,
  onLogicModeChange,
  conditions,
  onConditionsChange,
  attributeList,
  allOperations,
  editingOperationId = null,
}: OperationBuilderProps) {
  const updateCondition = useCallback(
    (idx: number, field: keyof Condition, value: string) => {
      onConditionsChange(
        conditions.map((c, i) => {
          if (i !== idx) return c;
          if (field === "operator") {
            const op = value as OperatorType;
            return {
              ...c,
              operator: op,
              value:
                op === "has_value" || op === "no_value" || op === "meets_operation" || op === "not_meets_operation"
                  ? null
                  : c.value,
            };
          }
          return { ...c, [field]: value };
        }),
      );
    },
    [conditions, onConditionsChange],
  );

  const updateSourceType = useCallback(
    (idx: number, newSource: ConditionSourceType) => {
      onConditionsChange(
        conditions.map((c, i) => {
          if (i !== idx) return c;
          return {
            ...c,
            sourceType: newSource,
            attribute: "",
            operator: newSource === "operation" ? "meets_operation" : "has_value",
            value: null,
          };
        }),
      );
    },
    [conditions, onConditionsChange],
  );

  const addCondition = useCallback(() => {
    onConditionsChange([...conditions, { sourceType: "attribute", attribute: "", operator: "has_value", value: null }]);
  }, [conditions, onConditionsChange]);

  const removeCondition = useCallback(
    (idx: number) => {
      if (conditions.length <= 1) return;
      onConditionsChange(conditions.filter((_, i) => i !== idx));
    },
    [conditions, onConditionsChange],
  );

  const validOpRefs = getValidOperationRefs(editingOperationId, allOperations);

  return (
    <div className="space-y-4">
      {/* Logic mode */}
      <div>
        <Label className="mb-2 block">Modo lógico</Label>
        <RadioGroup
          value={logicMode}
          onValueChange={(v) => onLogicModeChange(v as LogicMode)}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="all" id={`${idPrefix}-logic-all`} />
            <Label htmlFor={`${idPrefix}-logic-all`} className="font-normal cursor-pointer">
              Cumplir todas
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="any" id={`${idPrefix}-logic-any`} />
            <Label htmlFor={`${idPrefix}-logic-any`} className="font-normal cursor-pointer">
              Cumplir cualquiera
            </Label>
          </div>
        </RadioGroup>
        <p className="text-xs text-muted-foreground mt-1">
          {logicMode === "all"
            ? "Incluirá productos que cumplan todas las condiciones."
            : "Incluirá productos que cumplan al menos una de las condiciones."}
        </p>
      </div>

      {/* Conditions */}
      <div>
        <Label className="mb-2 block">Condiciones</Label>
        <div className="space-y-3">
          {conditions.map((cond, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <p className="text-xs font-medium text-muted-foreground py-1 pl-1">
                  {logicMode === "all" ? "y" : "o"}
                </p>
              )}
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                {/* Source type toggle */}
                <div className="flex items-center gap-3">
                  <ToggleGroup
                    type="single"
                    value={cond.sourceType || "attribute"}
                    onValueChange={(v) => v && updateSourceType(idx, v as ConditionSourceType)}
                    className="h-7"
                  >
                    <ToggleGroupItem value="attribute" className="text-xs h-7 px-3">
                      Atributo
                    </ToggleGroupItem>
                    <ToggleGroupItem value="operation" className="text-xs h-7 px-3">
                      Operación
                    </ToggleGroupItem>
                  </ToggleGroup>
                  <div className="flex-1" />
                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeCondition(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {(cond.sourceType || "attribute") === "attribute" ? (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Atributo</span>
                      <Select value={cond.attribute} onValueChange={(v) => updateCondition(idx, "attribute", v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar atributo…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {attributeList.map((a) => (
                            <SelectItem key={a} value={a}>
                              {a}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, "operator", v)}>
                        <SelectTrigger className="w-[180px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="has_value">Tiene valor</SelectItem>
                          <SelectItem value="no_value">No tiene valor</SelectItem>
                          <SelectItem value="equals">Es igual a</SelectItem>
                          <SelectItem value="not_equals">No es igual a</SelectItem>
                          <SelectItem value="contains">Contiene</SelectItem>
                          <SelectItem value="not_contains">No contiene</SelectItem>
                        </SelectContent>
                      </Select>
                      {cond.operator !== "has_value" && cond.operator !== "no_value" && (
                        <Input
                          value={cond.value || ""}
                          onChange={(e) => updateCondition(idx, "value", e.target.value)}
                          placeholder="Valor"
                          className="flex-1"
                        />
                      )}
                      {(cond.operator === "has_value" || cond.operator === "no_value") && <div className="flex-1" />}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">Operación</span>
                      <Select value={cond.attribute} onValueChange={(v) => updateCondition(idx, "attribute", v)}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Seleccionar operación…" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {validOpRefs.map((op) => (
                            <SelectItem key={op.id} value={op.id}>
                              {op.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, "operator", v)}>
                        <SelectTrigger className="w-[180px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="meets_operation">Cumple operación</SelectItem>
                          <SelectItem value="not_meets_operation">No cumple operación</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex-1" />
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={addCondition} className="mt-3 gap-1">
          <Plus className="h-3.5 w-3.5" /> Agregar condición
        </Button>
      </div>
    </div>
  );
});
