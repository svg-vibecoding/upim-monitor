// Mock data for PIM Completeness Monitor

export type UserRole = "PIM Manager" | "UsuarioPRO";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface PIMRecord {
  codigoJaivana: string;
  estadoGlobal: "Activo" | "Inactivo" | null;
  visibilidadB2B: "Visible" | "Oculto" | null;
  visibilidadB2C: "Visible" | "Oculto" | null;
  categoriaN1Comercial: string;
  clasificacionProducto: string;
  [key: string]: string | null;
}

export interface AttributeResult {
  name: string;
  totalSKUs: number;
  populated: number;
  completeness: number;
}

export interface DimensionResult {
  value: string;
  totalSKUs: number;
  populated: number;
  completeness: number;
}

export type UniverseKey = "all" | "active" | "visible_b2b" | "visible_b2c" | "digital_base" | "producto_foco";

export interface PredefinedReport {
  id: string;
  name: string;
  description: string;
  universe: string;
  universeKey: UniverseKey;
  operationId: string | null;
  attributes: string[];
}

export interface Dimension {
  id: string;
  name: string;
  field: string;
}

// Users
export const mockUsers: AppUser[] = [
  { id: "1", name: "Carlos Méndez", email: "carlos@upim.com", role: "UsuarioPRO", active: true },
  { id: "2", name: "Ana García", email: "ana@upim.com", role: "PIM Manager", active: true },
  { id: "3", name: "Luis Torres", email: "luis@upim.com", role: "PIM Manager", active: true },
  { id: "4", name: "María López", email: "maria@upim.com", role: "PIM Manager", active: false },
];

// Dimensions
export const mockDimensions: Dimension[] = [
  { id: "d1", name: "Categoría N1 Comercial", field: "categoriaN1Comercial" },
  { id: "d2", name: "Clasificación del Producto", field: "clasificacionProducto" },
];

// Categories and classifications
const categories = ["Alimentos", "Bebidas", "Aseo Hogar", "Cuidado Personal", "Mascotas", "Tecnología", "Ferretería", "Textil"];
const classifications = ["Producto Base", "Kit", "Combo", "Variante", "Accesorio", "Repuesto"];

// Attributes per report
const pimGeneralAttrs = [
  "Nombre Comercial", "Descripción Corta", "Descripción Larga", "Marca", "EAN",
  "Unidad de Medida", "Contenido Neto", "País de Origen", "Peso Bruto", "Alto",
  "Ancho", "Profundidad", "Material", "Color Principal", "Vida Útil",
];

const sumaGoB2BAttrs = [
  "Nombre Comercial", "Descripción Corta Web", "Descripción Larga Web",
  "Imagen Principal", "Imagen 2", "Imagen 3", "Ficha Técnica PDF",
  "Palabras Clave SEO", "Meta Description", "Categoría Web B2B",
  "Precio Sugerido B2B", "Unidad de Venta B2B",
];

const sumaGoB2CAttrs = [
  "Nombre Comercial", "Descripción Corta Web", "Descripción Larga Web",
  "Imagen Principal", "Imagen 2", "Imagen 3", "Video Producto",
  "Palabras Clave SEO", "Meta Description", "Categoría Web B2C",
  "Precio Sugerido B2C", "Información Nutricional", "Ingredientes",
];

const comprasAttrs = [
  "Código Proveedor", "Nombre Proveedor", "Referencia Proveedor",
  "Unidad de Compra", "Factor de Conversión", "Lead Time",
  "MOQ", "País Origen Compra", "Incoterm", "Moneda Compra",
];

// Predefined Reports
export const mockPredefinedReports: PredefinedReport[] = [
  {
    id: "r1", name: "PIM General", description: "Completitud general de atributos base del catálogo.",
    universe: "Todos los SKUs activos del PIM", universeKey: "active", attributes: pimGeneralAttrs,
  },
  {
    id: "r2", name: "SumaGO B2B", description: "Completitud de atributos para canal digital B2B.",
    universe: "SKUs con Visibilidad Adobe B2B = Visible", universeKey: "visible_b2b", attributes: sumaGoB2BAttrs,
  },
  {
    id: "r3", name: "SumaGO B2C", description: "Completitud de atributos para canal digital B2C.",
    universe: "SKUs con Visibilidad Adobe B2C = Visible", universeKey: "visible_b2c", attributes: sumaGoB2CAttrs,
  },
  {
    id: "r4", name: "Operaciones", description: "Completitud de atributos de gestión de operaciones.",
    universe: "Totalidad del PIM", universeKey: "all", attributes: comprasAttrs,
  },
];

// Generate mock PIM records
function generateMockData(): PIMRecord[] {
  const records: PIMRecord[] = [];
  const allAttrs = [...new Set([...pimGeneralAttrs, ...sumaGoB2BAttrs, ...sumaGoB2CAttrs, ...comprasAttrs])];

  for (let i = 0; i < 1200; i++) {
    const isActive = Math.random() > 0.12;
    const hasSumaGo = isActive ? Math.random() > 0.15 : Math.random() > 0.7;
    const record: PIMRecord = {
      codigoJaivana: `JAV-${String(i + 1).padStart(6, "0")}`,
      estadoGlobal: isActive ? "Activo" : "Inactivo",
      visibilidadB2B: hasSumaGo && Math.random() > 0.2 ? "Visible" : "Oculto",
      visibilidadB2C: hasSumaGo && Math.random() > 0.3 ? "Visible" : "Oculto",
      categoriaN1Comercial: categories[Math.floor(Math.random() * categories.length)],
      clasificacionProducto: classifications[Math.floor(Math.random() * classifications.length)],
    };
    for (const attr of allAttrs) {
      const fillRate = attr.includes("Imagen 3") || attr.includes("Video") ? 0.35
        : attr.includes("Imagen 2") ? 0.55
        : attr.includes("Meta Description") || attr.includes("Ficha") ? 0.5
        : attr.includes("Ingredientes") || attr.includes("Nutricional") ? 0.4
        : 0.75;
      record[attr] = Math.random() < fillRate ? `valor_${attr.replace(/\s/g, "_")}` : null;
    }
    records.push(record);
  }
  return records;
}

export const mockPIMData = generateMockData();

// Helper: compute attribute results for a set of records and attributes
export function computeAttributeResults(records: PIMRecord[], attributes: string[]): AttributeResult[] {
  return attributes.map((attr) => {
    const total = records.length;
    const populated = records.filter((r) => r[attr] !== null && r[attr] !== "" && r[attr] !== undefined).length;
    return { name: attr, totalSKUs: total, populated, completeness: total > 0 ? Math.round((populated / total) * 100) : 0 };
  });
}

// Helper: compute dimension distribution
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

// Helper: filter records per report universe
export function getRecordsForReport(reportId: string): PIMRecord[] {
  switch (reportId) {
    case "r1": return mockPIMData.filter((r) => r.estadoGlobal === "Activo");
    case "r2": return mockPIMData.filter((r) => r.visibilidadB2B === "Visible");
    case "r3": return mockPIMData.filter((r) => r.visibilidadB2C === "Visible");
    case "r4": return mockPIMData;
    default: return mockPIMData;
  }
}

// KPI computations
export function computeKPIs() {
  const total = mockPIMData.length;
  const active = mockPIMData.filter((r) => r.estadoGlobal === "Activo").length;
  const inactive = total - active;
  const digitalBase = 0;
  const visibleB2B = mockPIMData.filter((r) => r.visibilidadB2B === "Visible").length;
  const visibleB2C = mockPIMData.filter((r) => r.visibilidadB2C === "Visible").length;

  // Global completeness: average across all active SKUs and PIM General attrs
  const activeRecords = mockPIMData.filter((r) => r.estadoGlobal === "Activo");
  const attrResults = computeAttributeResults(activeRecords, pimGeneralAttrs);
  const globalCompleteness = Math.round(attrResults.reduce((s, a) => s + a.completeness, 0) / attrResults.length);

  return { total, active, inactive, digitalBase, visibleB2B, visibleB2C, globalCompleteness };
}

// Focus points: worst attributes
export function computeFocusPoints(): AttributeResult[] {
  const activeRecords = mockPIMData.filter((r) => r.estadoGlobal === "Activo");
  const allAttrs = [...new Set([...pimGeneralAttrs, ...sumaGoB2BAttrs, ...sumaGoB2CAttrs, ...comprasAttrs])];
  const results = computeAttributeResults(activeRecords, allAttrs);
  return results.sort((a, b) => a.completeness - b.completeness).slice(0, 5);
}

// CSV download helper
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const LAST_UPDATE_DATE = "2026-03-08T14:30:00";
