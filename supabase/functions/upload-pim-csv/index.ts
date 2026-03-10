import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Expected fixed columns (case-insensitive match)
const FIXED_COLUMNS: Record<string, string> = {
  "codigo jaivana": "codigo_jaivana",
  "código jaivaná": "codigo_jaivana",
  "codigo jaivaná": "codigo_jaivana",
  "código jaivana": "codigo_jaivana",
  "estado global": "estado_global",
  "codigo sumago": "codigo_sumago",
  "código sumago": "codigo_sumago",
  "visibilidad b2b": "visibilidad_b2b",
  "visibilidad b2c": "visibilidad_b2c",
  "categoria n1 comercial": "categoria_n1_comercial",
  "categoría n1 comercial": "categoria_n1_comercial",
  "clasificacion producto": "clasificacion_producto",
  "clasificación producto": "clasificacion_producto",
  "clasificacion del producto": "clasificacion_producto",
  "clasificación del producto": "clasificacion_producto",
};

const REQUIRED_COLUMN = "codigo_jaivana";

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((line) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === "," || ch === ";") {
          cells.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-]+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ error: "No se recibió ningún archivo." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) {
      return new Response(
        JSON.stringify({ error: "El archivo no tiene datos (solo encabezado o vacío)." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawHeaders = rows[0];
    // Map each column index to either a fixed DB column or an attribute name
    const columnMap: { index: number; dbColumn?: string; attrName?: string }[] = [];
    let hasCodigoJaivana = false;

    for (let i = 0; i < rawHeaders.length; i++) {
      const normalized = normalizeHeader(rawHeaders[i]);
      const dbCol = FIXED_COLUMNS[normalized];
      if (dbCol) {
        columnMap.push({ index: i, dbColumn: dbCol });
        if (dbCol === REQUIRED_COLUMN) hasCodigoJaivana = true;
      } else {
        // Treat as attribute
        columnMap.push({ index: i, attrName: rawHeaders[i] });
      }
    }

    if (!hasCodigoJaivana) {
      return new Response(
        JSON.stringify({
          error: `No se encontró la columna obligatoria "Código Jaivaná" (o variante). Columnas recibidas: ${rawHeaders.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build records
    const dataRows = rows.slice(1);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    // Deduplicate: keep last occurrence per codigo_jaivana
    const deduped = new Map<string, Record<string, unknown>>();
    for (let rowIdx = 0; rowIdx < dataRows.length; rowIdx++) {
      const cells = dataRows[rowIdx];
      const record: Record<string, unknown> = {};
      const attributes: Record<string, string | null> = {};

      for (const col of columnMap) {
        const value = cells[col.index]?.trim() || null;
        if (col.dbColumn) {
          record[col.dbColumn] = value;
        } else if (col.attrName && value) {
          attributes[col.attrName] = value;
        }
      }

      if (!record.codigo_jaivana) {
        errors++;
        errorDetails.push(`Fila ${rowIdx + 2}: código Jaivaná vacío`);
        continue;
      }

      record.attributes = attributes;
      deduped.set(record.codigo_jaivana as string, record);
    }

    const allRows = Array.from(deduped.values());

    // Process in batches of 500
    const BATCH_SIZE = 500;
    for (let batchStart = 0; batchStart < allRows.length; batchStart += BATCH_SIZE) {
      const upsertRows = allRows.slice(batchStart, batchStart + BATCH_SIZE);

      // Check which codes already exist
      const codes = upsertRows.map((r) => r.codigo_jaivana as string);
      const { data: existing } = await supabase
        .from("pim_records")
        .select("codigo_jaivana")
        .in("codigo_jaivana", codes);

      const existingSet = new Set((existing || []).map((r: { codigo_jaivana: string }) => r.codigo_jaivana));

      const { error: upsertError } = await supabase
        .from("pim_records")
        .upsert(upsertRows, { onConflict: "codigo_jaivana" });

      if (upsertError) {
        errors += upsertRows.length;
        errorDetails.push(`Batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: ${upsertError.message}`);
      } else {
        for (const r of upsertRows) {
          if (existingSet.has(r.codigo_jaivana as string)) {
            updated++;
          } else {
            inserted++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalRows: dataRows.length,
        inserted,
        updated,
        errors,
        errorDetails: errorDetails.slice(0, 20),
        columnsDetected: {
          fixed: columnMap.filter((c) => c.dbColumn).map((c) => c.dbColumn),
          attributes: columnMap.filter((c) => c.attrName).map((c) => c.attrName),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Error interno: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
