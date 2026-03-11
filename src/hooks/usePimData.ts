import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PIMRecord, PredefinedReport, Dimension, AttributeResult, DimensionResult } from "@/data/mockData";

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
  estado_global: string;
  codigo_sumago: string | null;
  visibilidad_b2b: string;
  visibilidad_b2c: string;
  categoria_n1_comercial: string | null;
  clasificacion_producto: string | null;
  attributes: Record<string, unknown> | unknown;
}): PIMRecord {
  const attrs = (typeof row.attributes === "object" && row.attributes !== null ? row.attributes : {}) as Record<string, string | null>;

  const estadoRaw = resolveField(row.estado_global, "Activo", attrs, "Estado (Global)");
  const estado = estadoRaw.toLowerCase() === "activo" ? "Activo" : "Inactivo";

  const visB2BRaw = resolveField(row.visibilidad_b2b, "Oculto", attrs, "Visibilidad Adobe B2B");
  const visB2B = visB2BRaw.toLowerCase() === "visible" ? "Visible" : "Oculto";

  const visB2CRaw = resolveField(row.visibilidad_b2c, "Oculto", attrs, "Visibilidad Adobe B2C");
  const visB2C = visB2CRaw.toLowerCase() === "visible" ? "Visible" : "Oculto";

  const sumaGo = row.codigo_sumago || attrs["SumaGO"] || null;

  const cleanAttrs = { ...attrs };
  delete cleanAttrs["Estado (Global)"];
  delete cleanAttrs["Visibilidad Adobe B2B"];
  delete cleanAttrs["Visibilidad Adobe B2C"];
  delete cleanAttrs["SumaGO"];

  return {
    codigoJaivana: row.codigo_jaivana,
    estadoGlobal: estado,
    codigoSumaGo: sumaGo,
    visibilidadB2B: visB2B,
    visibilidadB2C: visB2C,
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

// --- Structural attributes excluded from completeness by default ---
export const STRUCTURAL_ATTRIBUTES = [
  "Estado (Global)",
  "SumaGO",
  "Visibilidad Adobe B2B",
  "Visibilidad Adobe B2C",
];

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
          .not("attributes->Estado (Global)", "is", null)
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

export function computeAttributeResults(records: PIMRecord[], attributes: string[]): AttributeResult[] {
  return attributes.map((attr) => {
    const total = records.length;
    const populated = records.filter((r) => {
      const val = r[attr];
      return val !== null && val !== "" && val !== undefined;
    }).length;
    return { name: attr, totalSKUs: total, populated, completeness: total > 0 ? Math.round((populated / total) * 100) : 0 };
  });
}

export function computeDimensionResults(records: PIMRecord[], attributes: string[], dimensionField: string): DimensionResult[] {
  const groups: Record<string, PIMRecord[]> = {};
  for (const r of records) {
    const val = (r[dimensionField] as string) || "Sin valor";
    if (!groups[val]) groups[val] = [];
    groups[val].push(r);
  }
  return Object.entries(groups).map(([value, recs]) => {
    let totalChecks = 0;
    let populatedChecks = 0;
    for (const r of recs) {
      for (const attr of attributes) {
        totalChecks++;
        if (r[attr] !== null && r[attr] !== "" && r[attr] !== undefined) populatedChecks++;
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

export function computeFocusPoints(records: PIMRecord[], reports: PredefinedReport[]): AttributeResult[] {
  const activeRecords = records.filter((r) => r.estadoGlobal === "Activo");
  const allAttrs = [...new Set(reports.flatMap((r) => r.attributes))];
  if (allAttrs.length === 0 || activeRecords.length === 0) return [];
  const results = computeAttributeResults(activeRecords, allAttrs);
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
