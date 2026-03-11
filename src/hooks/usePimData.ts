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

  return {
    codigoJaivana: row.codigo_jaivana,
    estadoGlobal: estado as any,
    visibilidadB2B: visB2B as any,
    visibilidadB2C: visB2C as any,
    categoriaN1Comercial: row.categoria_n1_comercial || attrs["Categoría N1 Comercial"] || "",
    clasificacionProducto: row.clasificacion_producto || attrs["Clasificación del Producto"] || "",
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

/** Hardcoded classification map for this version. 
 *  Any attribute not listed here defaults to { type: "general", evaluable: true }.
 *  This map governs UI badges, completeness calculation, and functional logic.
 *  It does NOT constitute a complete validation of PIM load obligations. */
const ATTRIBUTE_CLASSIFICATION: Record<string, AttributeClassification> = {
  "Código Jaivaná":            { type: "base",      evaluable: false },
  "Estado (Global)":           { type: "funcional",  evaluable: false },
  "Visibilidad Adobe B2B":     { type: "funcional",  evaluable: true },
  "Visibilidad Adobe B2C":     { type: "funcional",  evaluable: true },
  "Categoría N1 Comercial":    { type: "dimensión",  evaluable: true },
  "Clasificación del Producto": { type: "dimensión", evaluable: true },
};

/** Get the classification for any attribute */
export function getAttributeClassification(attr: string): AttributeClassification {
  return ATTRIBUTE_CLASSIFICATION[attr] || { type: "general", evaluable: true };
}

/** Check if an attribute is non-evaluable */
export function isNonEvaluable(attr: string): boolean {
  return !getAttributeClassification(attr).evaluable;
}

// --- Legacy exports (derived from the map, for backward compat) ---

/** @deprecated Use getAttributeClassification instead */
export const FUNCTIONAL_FIELDS = Object.entries(ATTRIBUTE_CLASSIFICATION)
  .filter(([, c]) => c.type === "funcional")
  .map(([k]) => k);

/** @deprecated Use getAttributeClassification instead */
export const DIMENSION_FIELDS = Object.entries(ATTRIBUTE_CLASSIFICATION)
  .filter(([, c]) => c.type === "dimensión")
  .map(([k]) => k);

/** @deprecated Use isNonEvaluable instead */
export const NON_EVALUABLE_FIELDS = Object.entries(ATTRIBUTE_CLASSIFICATION)
  .filter(([, c]) => !c.evaluable)
  .map(([k]) => k);

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
export function usePimRecords() {
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
        attributes: r.attributes || [],
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
      }));
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

export function getRecordsForReport(allRecords: PIMRecord[], report: PredefinedReport): PIMRecord[] {
  const u = report.universe.toLowerCase();
  if (u.includes("activos")) return allRecords.filter((r) => r.estadoGlobal === "Activo");
  if (u.includes("b2b")) return allRecords.filter((r) => r.visibilidadB2B === "Visible");
  if (u.includes("b2c")) return allRecords.filter((r) => r.visibilidadB2C === "Visible");
  return allRecords;
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

export function useInvalidatePimData() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["pim-records"] });
    queryClient.invalidateQueries({ queryKey: ["pim-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    queryClient.invalidateQueries({ queryKey: ["pim-attribute-order"] });
  };
}
