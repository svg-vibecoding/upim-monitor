import * as XLSX from "xlsx";
import type { AttributeResult, DimensionResult, PIMRecord } from "@/data/mockData";

/** Fixed-field mapping: display name → PIMRecord key */
const FIXED_FIELD_MAP: Record<string, string> = {
  "Estado (Global)": "Estado (Global)",
  "Visibilidad Adobe B2B": "Visibilidad Adobe B2B",
  "Visibilidad Adobe B2C": "Visibilidad Adobe B2C",
  "Categoría N1 Comercial": "Categoría N1 Comercial",
  "Clasificación del Producto": "Clasificación del Producto",
};

function getRecordValue(record: PIMRecord, attr: string): string | null {
  const val = record[attr];
  return val != null && String(val) !== "" ? String(val) : null;
}

function buildSummarySheet(
  attrResults: AttributeResult[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
) {
  const rows: (string | number)[][] = [
    ["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"],
  ];
  attrResults.forEach((a) => rows.push([a.name, a.totalSKUs, a.populated, a.completeness]));

  if (dimensionResults?.length && dimensionName) {
    rows.push([]);
    rows.push([`Distribución por ${dimensionName}`, "", "", ""]);
    rows.push([dimensionName, "SKUs", "Poblados", "Completitud %"]);
    dimensionResults.forEach((d) => rows.push([d.value, d.totalSKUs, d.populated, d.completeness]));
  }

  return XLSX.utils.aoa_to_sheet(rows);
}

function forceColumnAsText(sheet: XLSX.WorkSheet, colIndex: number) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  for (let row = range.s.r + 1; row <= range.e.r; row++) {
    const addr = XLSX.utils.encode_cell({ r: row, c: colIndex });
    const cell = sheet[addr];
    if (cell) {
      cell.t = "s";
      cell.v = String(cell.v);
    }
  }
}

function buildProductsSheet(
  records: PIMRecord[],
  reportAttributes: string[],
  attributeOrder: string[],
) {
  // Build column order per the plan:
  // 1. Código Jaivaná (always first)
  // 2. Report attributes in attributeOrder order, excluding Estado (Global)
  // 3. Estado (Global) (always last)
  const estadoKey = "Estado (Global)";
  const orderedAttrs = attributeOrder.filter(
    (a) => reportAttributes.includes(a) && a !== estadoKey,
  );
  // Add any report attrs not in attributeOrder (shouldn't happen, but safety)
  reportAttributes.forEach((a) => {
    if (a !== estadoKey && !orderedAttrs.includes(a)) orderedAttrs.push(a);
  });

  const headers = ["Código Jaivaná", ...orderedAttrs, estadoKey];
  const rows: (string | number | null)[][] = [headers];

  records.forEach((r) => {
    const row: (string | null)[] = [r.codigoJaivana];
    orderedAttrs.forEach((attr) => row.push(getRecordValue(r, attr)));
    row.push(getRecordValue(r, estadoKey));
    rows.push(row);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  forceColumnAsText(sheet, 0); // Código Jaivaná as text
  return sheet;
}

function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/**
 * Export completeness-only .xlsx (single "Resumen" tab).
 */
export function exportCompletenessXlsx(
  filename: string,
  attrResults: AttributeResult[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSummarySheet(attrResults, dimensionResults, dimensionName);
  XLSX.utils.book_append_sheet(wb, ws, "Informe de Completitud");
  saveWorkbook(wb, filename);
}

/**
 * Export products-only .xlsx (single "Productos" tab).
 */
export function exportProductsXlsx(
  filename: string,
  records: PIMRecord[],
  reportAttributes: string[],
  attributeOrder: string[],
) {
  const wb = XLSX.utils.book_new();
  const productsWs = buildProductsSheet(records, reportAttributes, attributeOrder);
  XLSX.utils.book_append_sheet(wb, productsWs, "Productos");
  saveWorkbook(wb, filename);
}

/**
 * Export full report .xlsx with "Resumen" + "Productos" tabs.
 */
export function exportFullReportXlsx(
  filename: string,
  attrResults: AttributeResult[],
  records: PIMRecord[],
  reportAttributes: string[],
  attributeOrder: string[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
) {
  const wb = XLSX.utils.book_new();
  const summaryWs = buildSummarySheet(attrResults, dimensionResults, dimensionName);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Informe de Completitud");
  const productsWs = buildProductsSheet(records, reportAttributes, attributeOrder);
  XLSX.utils.book_append_sheet(wb, productsWs, "Productos");
  saveWorkbook(wb, filename);
}
