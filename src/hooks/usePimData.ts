import { useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PIMRecord, PredefinedReport, Dimension, AttributeResult, DimensionResult, UniverseKey } from "@/data/mockData";

// --- Fallback: read from JSONB attributes when fixed columns have defaults ---
function resolveField(
  fixedValue: string | null,
  fixedDefault: string,
  attributes: Record<string, string | null>,
  attrKey: string
): string {
  if (fixedValue === fixedDefault && attributes[attrKey]) {
    return attributes[attrKey]!;
  }
  return fixedValue || "";
}

function dbRowToPIMRecord(row: {
  codigo_jaivana: string;
  estado_global: string | null;
  visibilidad_b2b: string | null;
  visibilidad_b2c: string | null;
  categoria_n1_comercial: string | null;
  clasificacion_producto: string | null;
  attributes: Record<string, unknown> | unknown;
}): PIMRecord {
  const attrs = (typeof row.attributes === "object" && row.attributes !== null ? row.attributes : {}) as Record<string, string | null>;

  const estadoRaw = row.estado_global || attrs["Estado (Global)"] || null;
  const estado = estadoRaw
    ? (estadoRaw.toLowerCase() === "activo" ? "Activo" : "Inactivo")
    : null;

  const visB2BRaw = row.visibilidad_b2b || attrs["Visibilidad Adobe B2B"] || null;
  const visB2B = visB2BRaw
    ? (visB2BRaw.toLowerCase() === "visible" ? "Visible" : "Oculto")
    : null;

  const visB2CRaw = row.visibilidad_b2c || attrs["Visibilidad Adobe B2C"] || null;
  const visB2C = visB2CRaw
    ? (visB2CRaw.toLowerCase() === "visible" ? "Visible" : "Oculto")
    : null;

  const cleanAttrs = { ...attrs };
  delete cleanAttrs["Estado (Global)"];
  delete cleanAttrs["Visibilidad Adobe B2B"];
  delete cleanAttrs["Visibilidad Adobe B2C"];
  delete cleanAttrs["Categoría N1 Comercial"];
  delete cleanAttrs["Clasificación del Producto"];

  // Resolve values for fixed columns (prefer DB column, fallback to JSONB)
  const catN1 = row.categoria_n1_comercial || attrs["Categoría N1 Comercial"] || null;
  const clasifProd = row.clasificacion_producto || attrs["Clasificación del Producto"] || null;

  return {
    codigoJaivana: row.codigo_jaivana,
    estadoGlobal: estado as any,
    visibilidadB2B: visB2B as any,
    visibilidadB2C: visB2C as any,
    categoriaN1Comercial: catN1 || "",
    clasificacionProducto: clasifProd || "",
    // Display-name keys for attribute lookups in computeAttributeResults
    "Código Jaivaná": row.codigo_jaivana,
    "Estado (Global)": estadoRaw || null,
    "Visibilidad Adobe B2B": visB2BRaw || null,
    "Visibilidad Adobe B2C": visB2CRaw || null,
    "Categoría N1 Comercial": catN1,
    "Clasificación del Producto": clasifProd,
    ...cleanAttrs,
  };
}

// --- KPI type and hook (lightweight SQL aggregate) ---
export interface PimKPIs {
  total: number;
  active: number;
  inactive: number;
  digitalBase: number;
  visibleB2B: number;
  visibleB2C: number;
  lastUpdated: string | null;
}

export function usePimKPIs() {
  return useQuery({
    queryKey: ["pim-kpis"],
    queryFn: async (): Promise<PimKPIs> => {
      const { data, error } = await supabase.rpc("get_pim_kpis");
      if (error) throw error;
      const d = data as Record<string, unknown>;
      return {
        total: (d.total as number) || 0,
        active: (d.active as number) || 0,
        inactive: (d.inactive as number) || 0,
        digitalBase: (d.digital_base as number) || 0,
        visibleB2B: (d.visible_b2b as number) || 0,
        visibleB2C: (d.visible_b2c as number) || 0,
        lastUpdated: (d.last_updated as string) || null,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

// --- Server-side report completeness (avoids loading all records) ---
export interface AttributeCompleteness {
  name: string;
  totalSKUs: number;
  populated: number;
  completeness: number;
}

// --- Computed results layer (precomputed cache) ---

export function useComputedResult<T = unknown>(resultType: string, entityId?: string | null) {
  const key = entityId || "__global__";
  return useQuery({
    queryKey: ["computed-result", resultType, key],
    queryFn: async (): Promise<{ result: T; computed_at: string } | null> => {
      const { data, error } = await supabase
        .from("computed_results" as any)
        .select("result, computed_at")
        .eq("result_type", resultType)
        .eq("entity_id", key)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { result: (data as any).result as T, computed_at: (data as any).computed_at };
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useRefreshComputed() {
  const queryClient = useQueryClient();

  const refreshOne = async (type: string, entityId?: string | null) => {
    await supabase.rpc("refresh_computed_result" as any, {
      p_type: type,
      p_entity_id: entityId || null,
    });
    const key = entityId || "__global__";
    queryClient.invalidateQueries({ queryKey: ["computed-result", type, key] });
  };

  const refreshAll = async () => {
    await supabase.rpc("refresh_all_computed_results" as any);
    queryClient.invalidateQueries({ queryKey: ["computed-result"] });
    queryClient.invalidateQueries({ queryKey: ["pim-kpis"] });
    queryClient.refetchQueries({ queryKey: ["pim-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["report-completeness"] });
  };

  const refreshForOperation = async (opId: string, reports: PredefinedReport[]) => {
    // Refresh this operation's count
    await refreshOne("operation_count", opId);
    // Refresh completeness for reports that use this operation
    for (const r of reports) {
      if (r.operationId === opId) {
        await refreshOne("report_completeness", r.id);
      }
    }
    // Also refresh dashboard KPIs since operation counts feed into them
    await refreshOne("dashboard_kpis");
  };

  const refreshForReport = async (reportId: string) => {
    await refreshOne("report_completeness", reportId);
  };

  return { refreshOne, refreshAll, refreshForOperation, refreshForReport };
}

export function useOperationCount(operationId: string | null | undefined) {
  const cached = useComputedResult<number>("operation_count", operationId);
  const shouldFallback = !!operationId && cached.data === null && !cached.isLoading;

  // If no cached result exists, trigger a one-time computation
  const fallback = useQuery({
    queryKey: ["operation-count-live", operationId],
    queryFn: async (): Promise<number> => {
      // Trigger computation and store
      await supabase.rpc("refresh_computed_result" as any, {
        p_type: "operation_count",
        p_entity_id: operationId,
      });
      // Now read the result
      const { data, error } = await supabase
        .from("computed_results" as any)
        .select("result")
        .eq("result_type", "operation_count")
        .eq("entity_id", operationId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.result ?? 0;
    },
    enabled: shouldFallback,
    staleTime: 10 * 60 * 1000,
  });

  if (cached.data !== null && cached.data !== undefined) {
    return { data: cached.data.result, isLoading: cached.isLoading };
  }
  return { data: fallback.data ?? 0, isLoading: cached.isLoading || fallback.isLoading };
}

export function useReportCompleteness(reportId: string | null | undefined) {
  // Try cached result first
  const cached = useComputedResult<AttributeCompleteness[]>("report_completeness", reportId);
  const hasCached = cached.data !== null && cached.data !== undefined;
  const shouldFallbackLive = !!reportId && !hasCached && !cached.isLoading;

  // Fallback: compute live and store
  const live = useQuery({
    queryKey: ["report-completeness-live", reportId],
    queryFn: async (): Promise<AttributeCompleteness[]> => {
      if (!reportId) return [];
      // Trigger computation & store
      await supabase.rpc("refresh_computed_result" as any, {
        p_type: "report_completeness",
        p_entity_id: reportId,
      });
      // Read from cache
      const { data, error } = await supabase
        .from("computed_results" as any)
        .select("result")
        .eq("result_type", "report_completeness")
        .eq("entity_id", reportId)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.result as AttributeCompleteness[]) || [];
    },
    enabled: shouldFallbackLive,
    staleTime: 5 * 60 * 1000,
  });

  if (hasCached) {
    return { data: cached.data!.result, isLoading: cached.isLoading };
  }
  return { data: live.data, isLoading: cached.isLoading || live.isLoading };
}

// --- Attribute order from pim_metadata ---
export function useAttributeOrder() {
  return useQuery({
    queryKey: ["pim-attribute-order"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("pim_metadata" as any)
        .select("attribute_order")
        .eq("id", "singleton")
        .maybeSingle();
      if (error) throw error;
      if (!data) return [];
      return (data as any).attribute_order || [];
    },
    staleTime: 10 * 60 * 1000,
  });
}

// --- Attribute classification (type + evaluability as independent properties) ---

export type AttributeType = "base" | "funcional" | "dimensión" | "general";

export interface AttributeClassification {
  type: AttributeType;
  evaluable: boolean;
}

/** Maps universe_key values to the PIM attribute they depend on.
 *  This is the single source of truth for functional attribute detection.
 *  Must stay in sync with getRecordsForReport() filtering logic. */
export const UNIVERSE_KEY_ATTRIBUTE_MAP: Record<string, string | null> = {
  all: null,
  active: "Estado (Global)",
  digital_base: "Código SumaGo",
  visible_b2b: "Visibilidad Adobe B2B",
  visible_b2c: "Visibilidad Adobe B2C",
  producto_foco: "Producto foco",
};

/** Static classification for base attributes (always present regardless of config) */
const BASE_CLASSIFICATION: Record<string, AttributeClassification> = {
  "Código Jaivaná": { type: "base", evaluable: false },
};

/** Non-evaluable attributes (regardless of dynamic type) */
const NON_EVALUABLE_SET = new Set(["Código Jaivaná", "Estado (Global)"]);

/** Collect all attribute names used by active operations (including transitive refs) */
function getOperationAttributes(operations: Operation[]): Set<string> {
  const attrs = new Set<string>();
  for (const op of operations) {
    if (!op.active) continue;
    for (const c of op.conditions) {
      const source = c.sourceType || "attribute";
      if (source === "attribute" && c.attribute) {
        attrs.add(c.attribute);
      }
    }
  }
  return attrs;
}

/** Compute dynamic classification for an attribute based on active reports, dimensions, and operations.
 *  Priority: base > funcional > dimensión > general */
export function getAttributeClassification(
  attr: string,
  reports?: PredefinedReport[],
  dimensions?: Dimension[],
  operations?: Operation[],
): AttributeClassification {
  // Base attributes are always base
  if (BASE_CLASSIFICATION[attr]) return BASE_CLASSIFICATION[attr];

  const evaluable = !NON_EVALUABLE_SET.has(attr);

  // Check if any report depends on this attribute via universe_key
  if (reports) {
    for (const r of reports) {
      const depAttr = UNIVERSE_KEY_ATTRIBUTE_MAP[r.universeKey];
      if (depAttr === attr) return { type: "funcional", evaluable };
    }
  }

  // Check if any active operation uses this attribute in its conditions
  if (operations) {
    const opAttrs = getOperationAttributes(operations);
    if (opAttrs.has(attr)) return { type: "funcional", evaluable };
  }

  // Check if any dimension uses this attribute
  if (dimensions) {
    for (const d of dimensions) {
      if (d.field === attr) return { type: "dimensión", evaluable };
    }
  }

  return { type: "general", evaluable };
}

/** Protected attribute with reason for protection */
export interface ProtectedAttribute {
  attr: string;
  type: AttributeType;
  reason: string;
}

/** Compute all protected attributes from active reports, dimensions, and operations */
export function getProtectedAttributes(
  reports: PredefinedReport[],
  dimensions: Dimension[],
  operations?: Operation[],
): ProtectedAttribute[] {
  const result: ProtectedAttribute[] = [
    { attr: "Código Jaivaná", type: "base", reason: "Llave única de identificación" },
  ];
  const seen = new Set<string>(["Código Jaivaná"]);

  // Functional from reports
  for (const r of reports) {
    const depAttr = UNIVERSE_KEY_ATTRIBUTE_MAP[r.universeKey];
    if (depAttr && !seen.has(depAttr)) {
      seen.add(depAttr);
      result.push({ attr: depAttr, type: "funcional", reason: `Informe "${r.name}"` });
    }
  }

  // Functional from operations
  if (operations) {
    for (const op of operations) {
      if (!op.active) continue;
      for (const c of op.conditions) {
        const source = c.sourceType || "attribute";
        if (source === "attribute" && c.attribute && !seen.has(c.attribute)) {
          seen.add(c.attribute);
          result.push({ attr: c.attribute, type: "funcional", reason: `Operación "${op.name}"` });
        }
      }
    }
  }

  // Dimension attributes
  for (const d of dimensions) {
    if (!seen.has(d.field)) {
      seen.add(d.field);
      result.push({ attr: d.field, type: "dimensión", reason: `Dimensión "${d.name}"` });
    }
  }

  return result;
}

/** Hook: returns protected attributes based on current reports, dimensions, and operations */
export function useProtectedAttributes() {
  const { data: reports = [] } = usePredefinedReports();
  const { data: dimensions = [] } = useDimensions();
  const { data: operations = [] } = useOperations();
  return useMemo(() => getProtectedAttributes(reports, dimensions, operations), [reports, dimensions, operations]);
}



/** Check if an attribute is non-evaluable */
export function isNonEvaluable(attr: string): boolean {
  return !getAttributeClassification(attr).evaluable;
}

// --- Legacy exports (static fallback for backward compat, no dynamic context) ---

/** @deprecated Use getAttributeClassification instead */
export const FUNCTIONAL_FIELDS = ["Estado (Global)", "Visibilidad Adobe B2B", "Visibilidad Adobe B2C"];

/** @deprecated Use getAttributeClassification instead */
export const DIMENSION_FIELDS = ["Categoría N1 Comercial", "Clasificación del Producto"];

/** @deprecated Use isNonEvaluable instead */
export const NON_EVALUABLE_FIELDS = ["Código Jaivaná", "Estado (Global)"];

/** @deprecated Use FUNCTIONAL_FIELDS */
export const STRUCTURAL_ATTRIBUTES = FUNCTIONAL_FIELDS;

/** Fields stored as fixed DB columns (excluding Código Jaivaná which is handled separately) */
export const FIXED_COLUMN_FIELDS = [
  "Estado (Global)",
  "Visibilidad Adobe B2B",
  "Visibilidad Adobe B2C",
  "Categoría N1 Comercial",
  "Clasificación del Producto",
];

/** Build full attribute list from attribute_order.
 *  If attributeOrder already includes fixed-column fields (new upload format), use as-is.
 *  Otherwise (legacy format), prepend fixed-column fields for backward compat. */
export function getFullAttributeList(attributeOrder: string[]): string[] {
  const hasFixedInOrder = FIXED_COLUMN_FIELDS.some((f) => attributeOrder.includes(f));
  if (hasFixedInOrder) {
    // New format: attributeOrder already has everything in Excel order
    return attributeOrder;
  }
  // Legacy format: prepend fixed columns, then JSONB attrs
  const result = [...FIXED_COLUMN_FIELDS];
  for (const attr of attributeOrder) {
    if (!FIXED_COLUMN_FIELDS.includes(attr)) {
      result.push(attr);
    }
  }
  return result;
}

/** Given a full attribute order, return only evaluable attributes */
export function getEvaluableAttributes(allAttrs: string[]): string[] {
  return allAttrs.filter((a) => !NON_EVALUABLE_FIELDS.includes(a));
}

// --- Records hook (only fetches valid rows, excludes ghosts) ---
export function usePimRecords(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["pim-records"],
    queryFn: async (): Promise<PIMRecord[]> => {
      const allRows: PIMRecord[] = [];
      const PAGE_SIZE = 1000;
      let from = 0;
      let hasMore = true;

      while (hasMore) {
      const { data, error } = await supabase
          .from("pim_records")
          .select("*")
          .order("codigo_jaivana")
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allRows.push(...data.map(dbRowToPIMRecord));
          from += PAGE_SIZE;
          if (data.length < PAGE_SIZE) hasMore = false;
        }
      }
      return allRows;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePredefinedReports() {
  return useQuery({
    queryKey: ["predefined-reports"],
    queryFn: async (): Promise<PredefinedReport[]> => {
      const { data, error } = await supabase
        .from("predefined_reports")
        .select("*");
      if (error) throw error;
      return (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        universe: r.universe,
        universeKey: ((r as any).universe_key || "all") as UniverseKey,
        operationId: (r as any).operation_id || null,
        attributes: r.attributes || [],
        displayOrder: (r as any).display_order ?? 99,
        showInFocus: (r as any).show_in_focus ?? true,
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// --- Mutation to update report attributes ---
export function useUpdateReportAttributes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, attributes }: { reportId: string; attributes: string[] }) => {
      const { error } = await supabase
        .from("predefined_reports")
        .update({ attributes })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    },
  });
}

export function useDimensions() {
  return useQuery({
    queryKey: ["dimensions"],
    queryFn: async (): Promise<Dimension[]> => {
      const { data, error } = await supabase
        .from("dimensions")
        .select("*");
      if (error) throw error;
      return (data || []).map((d) => ({
        id: d.id,
        name: d.name,
        field: d.field,
      })).sort((a, b) => a.name.localeCompare(b.name, "es"));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// --- Pure computation functions ---

/** Filter attributes to only those that actually exist in the PIM data */
export function filterRealAttributes(attributes: string[], realAttributeKeys: string[]): string[] {
  if (realAttributeKeys.length === 0) return attributes;
  const realSet = new Set(realAttributeKeys);
  return attributes.filter((a) => realSet.has(a));
}

/** Check if a value is considered empty (null, undefined, empty string, or whitespace-only) */
function isEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  return false;
}

export function computeAttributeResults(records: PIMRecord[], attributes: string[]): AttributeResult[] {
  return attributes.map((attr) => {
    const total = records.length;
    const populated = records.filter((r) => !isEmptyValue(r[attr])).length;
    return { name: attr, totalSKUs: total, populated, completeness: total > 0 ? Math.round((populated / total) * 100) : 0 };
  });
}

export function computeDimensionResults(records: PIMRecord[], attributes: string[], dimensionField: string): DimensionResult[] {
  const groups: Record<string, PIMRecord[]> = {};
  for (const r of records) {
    const rawVal = r[dimensionField] as string | null;
    const val = (rawVal && rawVal.trim() !== "") ? rawVal : "Sin valor asignado";
    if (!groups[val]) groups[val] = [];
    groups[val].push(r);
  }
  return Object.entries(groups).map(([value, recs]) => {
    let totalChecks = 0;
    let populatedChecks = 0;
    for (const r of recs) {
      for (const attr of attributes) {
        totalChecks++;
        if (!isEmptyValue(r[attr])) populatedChecks++;
      }
    }
    return {
      value,
      totalSKUs: recs.length,
      populated: populatedChecks,
      completeness: totalChecks > 0 ? Math.round((populatedChecks / totalChecks) * 100) : 0,
    };
  }).sort((a, b) => a.completeness - b.completeness);
}

export function getRecordsForReport(allRecords: PIMRecord[], report: PredefinedReport, allOperations?: Operation[]): PIMRecord[] {
  // If report has an operation, use it for filtering
  if (report.operationId && allOperations) {
    const operation = allOperations.find((op) => op.id === report.operationId);
    if (operation) {
      return allRecords.filter((r) => evaluateOperation(r, operation, allOperations));
    }
  }
  // Fallback to legacy universe_key logic
  switch (report.universeKey) {
    case "active":
      return allRecords.filter((r) => r.estadoGlobal === "Activo");
    case "visible_b2b":
      return allRecords.filter((r) => r.visibilidadB2B === "Visible");
    case "visible_b2c":
      return allRecords.filter((r) => r.visibilidadB2C === "Visible");
    case "digital_base":
      return allRecords.filter((r) => {
        const codigoSumaGo = r["Código SumaGo"];
        return codigoSumaGo !== null && codigoSumaGo !== undefined && String(codigoSumaGo).trim() !== "";
      });
    case "producto_foco":
      return allRecords.filter((r) => {
        const val = r["Producto foco"];
        return val !== null && val !== undefined && String(val).trim().toUpperCase() === "SI";
      });
    case "all":
    default:
      return allRecords;
  }
}

// --- Mutation to update report operation ---
export function useUpdateReportOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, operationId }: { reportId: string; operationId: string | null }) => {
      const { error } = await supabase
        .from("predefined_reports")
        .update({ operation_id: operationId } as any)
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
      queryClient.invalidateQueries({ queryKey: ["report-completeness"] });
    },
  });
}

// --- Mutation to create a new predefined report ---
export function useCreatePredefinedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      name,
      description,
      operationId,
      attributes,
      showInFocus = true,
    }: {
      name: string;
      description: string;
      operationId: string | null;
      attributes: string[];
      showInFocus?: boolean;
    }) => {
      const { error } = await supabase.from("predefined_reports").insert({
        name,
        description,
        universe: operationId ? "" : "Base general del PIM",
        universe_key: operationId ? "all" : "all",
        operation_id: operationId,
        attributes,
        show_in_focus: showInFocus,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    },
  });
}

/** Sort reports by display_order column */
export function sortReportsByDisplayOrder<T extends { displayOrder?: number; name: string }>(reports: T[]): T[] {
  return [...reports].sort((a, b) => {
    const oA = a.displayOrder ?? 99;
    const oB = b.displayOrder ?? 99;
    if (oA !== oB) return oA - oB;
    return a.name.localeCompare(b.name);
  });
}

/** Mutation to swap display_order of two reports */
export function useReorderReports() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const u of updates) {
        const { error } = await supabase
          .from("predefined_reports")
          .update({ display_order: u.display_order } as any)
          .eq("id", u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    },
  });
}

export function computeFocusPoints(records: PIMRecord[], reports: PredefinedReport[], realAttributeKeys: string[] = []): AttributeResult[] {
  const activeRecords = records.filter((r) => r.estadoGlobal === "Activo");
  const allAttrs = [...new Set(reports.flatMap((r) => r.attributes))];
  const validAttrs = getEvaluableAttributes(
    realAttributeKeys.length > 0 ? filterRealAttributes(allAttrs, realAttributeKeys) : allAttrs
  );
  if (validAttrs.length === 0 || activeRecords.length === 0) return [];
  const results = computeAttributeResults(activeRecords, validAttrs);
  return results.sort((a, b) => a.completeness - b.completeness).slice(0, 5);
}

// --- Operations ---

export type OperatorType = "has_value" | "no_value" | "equals" | "not_equals" | "contains" | "not_contains" | "meets_operation" | "not_meets_operation";
export type ConditionSourceType = "attribute" | "operation";
export type LogicMode = "all" | "any";
export type LinkedKpi = "digital_base" | "visible_b2b" | "visible_b2c";

export const LINKED_KPI_LABELS: Record<LinkedKpi, string> = {
  digital_base: "Base Digital",
  visible_b2b: "Visibles B2B",
  visible_b2c: "Visibles B2C",
};

export interface Condition {
  sourceType?: ConditionSourceType; // defaults to "attribute" for backward compat
  attribute: string; // attribute name OR operation id depending on sourceType
  operator: OperatorType;
  value: string | null;
}

export interface Operation {
  id: string;
  name: string;
  description: string;
  active: boolean;
  logicMode: LogicMode;
  conditions: Condition[];
  linkedKpi: LinkedKpi | null;
  createdAt: string;
  updatedAt: string;
}

function dbRowToOperation(row: any): Operation {
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    active: row.active,
    logicMode: row.logic_mode || "all",
    conditions: (Array.isArray(row.conditions) ? row.conditions : []) as Condition[],
    linkedKpi: row.linked_kpi || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useOperations() {
  return useQuery({
    queryKey: ["operations"],
    queryFn: async (): Promise<Operation[]> => {
      const { data, error } = await supabase
        .from("operations" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map(dbRowToOperation);
    },
    staleTime: 5 * 60 * 1000,
  });
}

function matchCondition(record: PIMRecord, cond: Condition, allOperations?: Operation[], visited?: Set<string>): boolean {
  const source = cond.sourceType || "attribute";

  if (source === "operation") {
    // cond.attribute holds the operation ID
    const refOp = allOperations?.find((o) => o.id === cond.attribute);
    if (!refOp) return false;
    const result = evaluateOperationSafe(record, refOp, allOperations || [], visited);
    return cond.operator === "meets_operation" ? result : !result;
  }

  const raw = record[cond.attribute];
  const isEmpty = raw === null || raw === undefined || String(raw).trim() === "";
  switch (cond.operator) {
    case "has_value": return !isEmpty;
    case "no_value": return isEmpty;
    case "equals": return !isEmpty && String(raw).toLowerCase() === (cond.value ?? "").toLowerCase();
    case "not_equals": return isEmpty || String(raw).toLowerCase() !== (cond.value ?? "").toLowerCase();
    case "contains": return !isEmpty && String(raw).toLowerCase().includes((cond.value ?? "").toLowerCase());
    case "not_contains": return isEmpty || !String(raw).toLowerCase().includes((cond.value ?? "").toLowerCase());
    default: return false;
  }
}

/** Evaluate operation with circular reference protection */
function evaluateOperationSafe(record: PIMRecord, operation: Operation, allOperations: Operation[], visited?: Set<string>): boolean {
  const seen = visited ? new Set(visited) : new Set<string>();
  if (seen.has(operation.id)) return false; // circular ref → fail safe
  seen.add(operation.id);
  if (operation.conditions.length === 0) return true;
  const fn = operation.logicMode === "any" ? "some" : "every";
  return operation.conditions[fn]((c) => matchCondition(record, c, allOperations, seen));
}

export function evaluateOperation(record: PIMRecord, operation: Operation, allOperations?: Operation[]): boolean {
  return evaluateOperationSafe(record, operation, allOperations || [], new Set());
}

/** Check if adding opRefId as a dependency of currentOpId would create a circular reference */
export function wouldCreateCircularRef(
  currentOpId: string | null,
  opRefId: string,
  allOperations: Operation[],
): boolean {
  if (!currentOpId) return false;
  if (opRefId === currentOpId) return true;

  // BFS: check if opRefId (directly or transitively) depends on currentOpId
  const visited = new Set<string>();
  const queue = [opRefId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const op = allOperations.find((o) => o.id === id);
    if (!op) continue;
    for (const c of op.conditions) {
      if ((c.sourceType || "attribute") === "operation") {
        if (c.attribute === currentOpId) return true;
        queue.push(c.attribute);
      }
    }
  }
  return false;
}

/** Get list of operation IDs that are valid references (no self-ref, no circular) */
export function getValidOperationRefs(
  currentOpId: string | null,
  allOperations: Operation[],
): Operation[] {
  return allOperations.filter((op) => {
    if (op.id === currentOpId) return false;
    if (currentOpId && wouldCreateCircularRef(currentOpId, op.id, allOperations)) return false;
    return true;
  });
}


export interface PimUploadRecord {
  id: string;
  file_name: string;
  uploaded_at: string;
  total_rows: number;
  unique_rows: number;
  inserted: number;
  updated: number;
  errors: number;
  status: "pending" | "active" | "discarded";
  attribute_order: string[];
}

export function usePimUploadHistory() {
  return useQuery({
    queryKey: ["pim-upload-history"],
    queryFn: async (): Promise<PimUploadRecord[]> => {
      const { data, error } = await supabase
        .from("pim_upload_history" as any)
        .select("*")
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PimUploadRecord[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useInvalidatePimData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["pim-records"] });
    queryClient.invalidateQueries({ queryKey: ["pim-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    queryClient.invalidateQueries({ queryKey: ["pim-attribute-order"] });
    queryClient.invalidateQueries({ queryKey: ["pim-upload-history"] });
    queryClient.invalidateQueries({ queryKey: ["operations"] });
    queryClient.invalidateQueries({ queryKey: ["computed-result"] });
    queryClient.invalidateQueries({ queryKey: ["report-completeness-live"] });
    queryClient.invalidateQueries({ queryKey: ["operation-count-live"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-cards-config"] });
  };
}

// --- Dashboard Cards Config ---

export type CardColor = "green" | "red" | "yellow" | "blue" | "gray" | "none";

export interface Card1Config {
  main_value: "total" | string; // "total" or operation_id
  main_label: string;
  main_color: CardColor;
  main_pct: boolean;
  secondary_1: string | null;
  secondary_1_label: string;
  secondary_1_color: CardColor;
  secondary_1_pct: boolean;
  secondary_2: string | null;
  secondary_2_label: string;
  secondary_2_color: CardColor;
  secondary_2_pct: boolean;
}

export interface Card2Config {
  main_operation: string | null;
  main_label: string;
  main_color: CardColor;
  main_pct: boolean;
  secondary_1: string | null;
  secondary_1_label: string;
  secondary_1_color: CardColor;
  secondary_1_pct: boolean;
  secondary_2: string | null;
  secondary_2_label: string;
  secondary_2_color: CardColor;
  secondary_2_pct: boolean;
}

export interface Card3Config {
  report_id: string | null;
}

export interface DashboardCardConfig {
  card_key: string;
  label: string;
  config: Card1Config | Card2Config | Card3Config;
  updated_at: string;
}

export function useDashboardCardsConfig() {
  return useQuery({
    queryKey: ["dashboard-cards-config"],
    queryFn: async (): Promise<DashboardCardConfig[]> => {
      const { data, error } = await supabase
        .from("dashboard_cards_config" as any)
        .select("*");
      if (error) throw error;
      return (data || []) as unknown as DashboardCardConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateDashboardCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardKey, label, config }: { cardKey: string; label: string; config: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("dashboard_cards_config" as any)
        .update({ label, config, updated_at: new Date().toISOString() } as any)
        .eq("card_key", cardKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-cards-config"] });
    },
  });
}
