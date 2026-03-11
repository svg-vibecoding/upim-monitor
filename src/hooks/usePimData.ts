import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PIMRecord, PredefinedReport, Dimension, AttributeResult, DimensionResult } from "@/data/mockData";

// --- Transform DB row → PIMRecord ---
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
  return {
    codigoJaivana: row.codigo_jaivana,
    estadoGlobal: row.estado_global as "Activo" | "Inactivo",
    codigoSumaGo: row.codigo_sumago,
    visibilidadB2B: row.visibilidad_b2b as "Visible" | "Oculto",
    visibilidadB2C: row.visibilidad_b2c as "Visible" | "Oculto",
    categoriaN1Comercial: row.categoria_n1_comercial || "",
    clasificacionProducto: row.clasificacion_producto || "",
    ...attrs,
  };
}

// --- Hooks ---

export function usePimRecords() {
  return useQuery({
    queryKey: ["pim-records"],
    queryFn: async (): Promise<PIMRecord[]> => {
      // Fetch all records (handle >1000 rows with pagination)
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
    staleTime: 5 * 60 * 1000, // 5 min
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

export function useLastPimUpdate() {
  return useQuery({
    queryKey: ["pim-last-update"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("pim_records")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0]?.updated_at || null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// --- Pure computation functions (same logic as mockData but accept params) ---

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
  return allRecords; // "Totalidad del PIM" or default
}

export function computeKPIs(records: PIMRecord[], reports: PredefinedReport[]) {
  const total = records.length;
  const active = records.filter((r) => r.estadoGlobal === "Activo").length;
  const inactive = total - active;
  const digitalBase = records.filter((r) => r.codigoSumaGo !== null).length;
  const visibleB2B = records.filter((r) => r.visibilidadB2B === "Visible").length;
  const visibleB2C = records.filter((r) => r.visibilidadB2C === "Visible").length;

  // Global completeness: use first report (PIM General) or all attributes from first report
  const activeRecords = records.filter((r) => r.estadoGlobal === "Activo");
  const pimGeneral = reports.find((r) => r.name.toLowerCase().includes("general"));
  const attrs = pimGeneral?.attributes || [];
  let globalCompleteness = 0;
  if (attrs.length > 0 && activeRecords.length > 0) {
    const attrResults = computeAttributeResults(activeRecords, attrs);
    globalCompleteness = Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length);
  }

  return { total, active, inactive, digitalBase, visibleB2B, visibleB2C, globalCompleteness };
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
    queryClient.invalidateQueries({ queryKey: ["predefined-reports"] });
    queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    queryClient.invalidateQueries({ queryKey: ["pim-last-update"] });
  };
}
