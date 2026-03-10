import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[_\-]+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Expect JSON body with { rows: Record<string, unknown>[] } parsed client-side
    const { rows: jsonRows } = await req.json() as { rows: Record<string, unknown>[] };

    if (!jsonRows || jsonRows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No se recibieron datos." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawHeaders = Object.keys(jsonRows[0]);
    const columnMap: { header: string; dbColumn?: string; attrName?: string }[] = [];
    let hasCodigoJaivana = false;

    for (const header of rawHeaders) {
      const normalized = normalizeHeader(header);
      const dbCol = FIXED_COLUMNS[normalized];
      if (dbCol) {
        columnMap.push({ header, dbColumn: dbCol });
        if (dbCol === REQUIRED_COLUMN) hasCodigoJaivana = true;
      } else {
        columnMap.push({ header, attrName: header });
      }
    }

    if (!hasCodigoJaivana) {
      return new Response(
        JSON.stringify({
          error: `No se encontró la columna obligatoria "Código Jaivaná". Columnas recibidas: ${rawHeaders.join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let inserted = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    const deduped = new Map<string, Record<string, unknown>>();
    for (let rowIdx = 0; rowIdx < jsonRows.length; rowIdx++) {
      const row = jsonRows[rowIdx];
      const record: Record<string, unknown> = {};
      const attributes: Record<string, string | null> = {};

      for (const col of columnMap) {
        const rawValue = row[col.header];
        const value = rawValue != null && String(rawValue).trim() !== "" ? String(rawValue).trim() : null;
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

      record.codigo_jaivana = String(record.codigo_jaivana);
      record.attributes = attributes;
      deduped.set(record.codigo_jaivana as string, record);
    }

    const allRows = Array.from(deduped.values());

    const BATCH_SIZE = 500;
    for (let batchStart = 0; batchStart < allRows.length; batchStart += BATCH_SIZE) {
      const upsertRows = allRows.slice(batchStart, batchStart + BATCH_SIZE);
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
        totalRows: jsonRows.length,
        uniqueRows: allRows.length,
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
