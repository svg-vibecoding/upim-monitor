import * as XLSX from "xlsx-js-style";
import type { AttributeResult, DimensionResult, PIMRecord } from "@/data/mockData";

/** Metadata for the report header ("ficha técnica") */
export interface ReportMeta {
  reportName: string;
  universe: string;
  totalSKUs: number;
  evaluatedAttrs: number;
  focusAttrs: number;
  avgCompleteness: number;
}

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

const BOLD_STYLE = { font: { bold: true } };
const BOLD_LEFT_STYLE = { font: { bold: true }, alignment: { horizontal: "left" } };
const LEFT_STYLE = { alignment: { horizontal: "left" } };
const TITLE_STYLE = { font: { bold: true, sz: 14 } };
const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { fgColor: { rgb: "6B54D1" } },
};
const THOUSANDS_FMT = "#,##0";
const INT_PCT_FMT = "0\\%";

function setCellStyle(sheet: XLSX.WorkSheet, addr: string, style: Record<string, unknown>) {
  const cell = sheet[addr];
  if (cell) cell.s = style;
}

function autoFitColumns(sheet: XLSX.WorkSheet, maxWidth = 60) {
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const colWidths: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    let max = 8;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v != null) {
        const len = String(cell.v).length;
        if (len > max) max = len;
      }
    }
    colWidths.push(Math.min(max + 3, maxWidth));
  }
  sheet["!cols"] = colWidths.map((w) => ({ wch: w }));
}

function buildSummarySheet(
  attrResults: AttributeResult[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
  meta?: ReportMeta,
) {
  const rows: (string | number)[][] = [];
  let metaRowCount = 0;

  if (meta) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
    const timeStr = now.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    rows.push(["Ficha técnica del informe", ""]);
    rows.push([]);
    rows.push(["Fecha de descarga", `${dateStr}, ${timeStr}`]);
    rows.push(["Informe", meta.reportName]);
    rows.push(["Universo de Productos evaluado:", `${meta.totalSKUs} SKUs`]);
    rows.push(["Total SKUs evaluados", meta.totalSKUs]);
    rows.push(["Atributos evaluados", meta.evaluatedAttrs]);
    rows.push(["Atributos foco de atención (< 50%)", meta.focusAttrs]);
    rows.push(["Completitud promedio", `${meta.avgCompleteness}%`]);
    rows.push([]);
    metaRowCount = 10;
  }

  const headerRow = metaRowCount;
  rows.push(["Atributo", "SKUs Evaluados", "Valores Poblados", "Completitud %"]);
  attrResults.forEach((a) => rows.push([a.name, a.totalSKUs, a.populated, a.completeness]));

  let dimHeaderRow = -1;
  if (dimensionResults?.length && dimensionName) {
    rows.push([]);
    rows.push([`Distribución por ${dimensionName}`, "", "", ""]);
    dimHeaderRow = rows.length;
    rows.push([dimensionName, "SKUs", "Poblados", "Completitud %"]);
    dimensionResults.forEach((d) => rows.push([d.value, d.totalSKUs, d.populated, d.completeness]));
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);

  // --- Styling ---
  if (meta) {
    // Title: bold + size 14
    setCellStyle(sheet, "A1", TITLE_STYLE);
    // Bold all labels in column A + left-align values in column B of ficha técnica (rows 3-9, 0-indexed 2-8)
    for (let r = 2; r <= 8; r++) {
      setCellStyle(sheet, XLSX.utils.encode_cell({ r, c: 0 }), BOLD_STYLE);
      setCellStyle(sheet, XLSX.utils.encode_cell({ r, c: 1 }), LEFT_STYLE);
    }
  }

  // Header row: purple bg, white bold text
  for (let c = 0; c < 4; c++) {
    setCellStyle(sheet, XLSX.utils.encode_cell({ r: headerRow, c }), HEADER_STYLE);
  }

  // Data rows: thousands format for cols B,C and integer % for col D
  for (let r = headerRow + 1; r < headerRow + 1 + attrResults.length; r++) {
    const addrB = XLSX.utils.encode_cell({ r, c: 1 });
    const addrC = XLSX.utils.encode_cell({ r, c: 2 });
    const addrD = XLSX.utils.encode_cell({ r, c: 3 });
    if (sheet[addrB]) sheet[addrB].z = THOUSANDS_FMT;
    if (sheet[addrC]) sheet[addrC].z = THOUSANDS_FMT;
    if (sheet[addrD]) sheet[addrD].z = INT_PCT_FMT;
  }

  // Dimension section header
  if (dimHeaderRow > 0) {
    for (let c = 0; c < 4; c++) {
      setCellStyle(sheet, XLSX.utils.encode_cell({ r: dimHeaderRow, c }), HEADER_STYLE);
    }
    // Dimension data rows
    const dimDataStart = dimHeaderRow + 1;
    const dimDataEnd = dimDataStart + (dimensionResults?.length || 0);
    for (let r = dimDataStart; r < dimDataEnd; r++) {
      const addrB = XLSX.utils.encode_cell({ r, c: 1 });
      const addrC = XLSX.utils.encode_cell({ r, c: 2 });
      const addrD = XLSX.utils.encode_cell({ r, c: 3 });
      if (sheet[addrB]) sheet[addrB].z = THOUSANDS_FMT;
      if (sheet[addrC]) sheet[addrC].z = THOUSANDS_FMT;
      if (sheet[addrD]) sheet[addrD].z = INT_PCT_FMT;
    }
  }

  autoFitColumns(sheet);

  return sheet;
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
  const estadoKey = "Estado (Global)";
  const orderedAttrs = attributeOrder.filter(
    (a) => reportAttributes.includes(a) && a !== estadoKey,
  );
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
  forceColumnAsText(sheet, 0);

  // Bold header row
  for (let c = 0; c < headers.length; c++) {
    setCellStyle(sheet, XLSX.utils.encode_cell({ r: 0, c }), BOLD_STYLE);
  }

  // Auto-fit columns with max 35
  autoFitColumns(sheet, 35);

  return sheet;
}

function saveWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

/**
 * Export completeness-only .xlsx (single "Informe de Completitud" tab).
 */
export function exportCompletenessXlsx(
  filename: string,
  attrResults: AttributeResult[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
  meta?: ReportMeta,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSummarySheet(attrResults, dimensionResults, dimensionName, meta);
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
 * Export full report .xlsx with "Informe de Completitud" + "Productos" tabs.
 */
export function exportFullReportXlsx(
  filename: string,
  attrResults: AttributeResult[],
  records: PIMRecord[],
  reportAttributes: string[],
  attributeOrder: string[],
  dimensionResults?: DimensionResult[],
  dimensionName?: string,
  meta?: ReportMeta,
) {
  const wb = XLSX.utils.book_new();
  const summaryWs = buildSummarySheet(attrResults, dimensionResults, dimensionName, meta);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Informe de Completitud");
  const productsWs = buildProductsSheet(records, reportAttributes, attributeOrder);
  XLSX.utils.book_append_sheet(wb, productsWs, "Productos");
  saveWorkbook(wb, filename);
}
